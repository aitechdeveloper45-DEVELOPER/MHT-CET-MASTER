import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useStudyTimeTracker = (userId: string | undefined) => {
  const startTimeRef = useRef<number>(Date.now());
  const accumulatedTimeRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(true);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, pause tracking
        if (isActiveRef.current) {
          const sessionTime = Date.now() - startTimeRef.current;
          accumulatedTimeRef.current += sessionTime;
          isActiveRef.current = false;
        }
      } else {
        // Page is visible, resume tracking
        startTimeRef.current = Date.now();
        isActiveRef.current = true;
      }
    };

    // Update study time in database every minute
    const updateStudyTime = async () => {
      if (!isActiveRef.current) return;

      const currentSessionTime = Date.now() - startTimeRef.current;
      const totalMinutes = Math.floor((accumulatedTimeRef.current + currentSessionTime) / 60000);

      if (totalMinutes > 0) {
        try {
          // Update user stats
          const { data: currentStats } = await supabase
            .from('user_stats')
            .select('study_time_minutes')
            .eq('user_id', userId)
            .single();

          const newStudyTime = (currentStats?.study_time_minutes || 0) + totalMinutes;

          await supabase
            .from('user_stats')
            .update({ 
              study_time_minutes: newStudyTime,
              last_study_date: new Date().toISOString().split('T')[0]
            })
            .eq('user_id', userId);

          // Update weekly goal for study time
          const currentWeekStart = new Date();
          currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
          const weekStartStr = currentWeekStart.toISOString().split('T')[0];

          const { data: studyGoal } = await supabase
            .from('weekly_goals')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStartStr)
            .ilike('goal_title', '%study%hours%')
            .maybeSingle();

          if (studyGoal) {
            // Calculate hours this week
            const hoursThisWeek = Math.floor(totalMinutes / 60);
            
            await supabase
              .from('weekly_goals')
              .update({ current_value: hoursThisWeek })
              .eq('id', studyGoal.id);
          }

          // Reset accumulated time after successful update
          accumulatedTimeRef.current = 0;
          startTimeRef.current = Date.now();
        } catch (error) {
          console.error('Error updating study time:', error);
        }
      }
    };

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Update every 60 seconds (1 minute)
    updateIntervalRef.current = setInterval(updateStudyTime, 60000);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      // Final update on unmount
      if (isActiveRef.current) {
        const finalSessionTime = Date.now() - startTimeRef.current;
        accumulatedTimeRef.current += finalSessionTime;
      }

      // Save final accumulated time
      const totalMinutes = Math.floor(accumulatedTimeRef.current / 60000);
      if (totalMinutes > 0 && userId) {
        (async () => {
          try {
            const { data } = await supabase
              .from('user_stats')
              .select('study_time_minutes')
              .eq('user_id', userId)
              .single();
            
            const newStudyTime = (data?.study_time_minutes || 0) + totalMinutes;
            await supabase
              .from('user_stats')
              .update({ study_time_minutes: newStudyTime })
              .eq('user_id', userId);
          } catch (error) {
            console.error('Error in final study time update:', error);
          }
        })();
      }
    };
  }, [userId]);
};
