What Breaks at 5,000 Workers
1.Storage breaks first — audio files save to local disk, which is wiped on redeploy and doesn't scale past one server. Fix: move to Supabase Storage / S3.
2.ffmpeg processing has no limit — a spike in uploads runs too many ffmpeg jobs at once, server slows/crashes. Fix: process audio in a background queue with a concurrency cap.
3.Uploads fail silently on bad mobile connections — no retry, no clear error. Fix: show real failure state, add retry/chunked upload.
4.No duplicate check on submissions — same person can submit multiple times, nothing links it to Task 1's people table. Fix: check phone against existing records before saving.
Cost risk is mainly bandwidth/storage for audio + unthrottled compute — fixing #1 and #2 fixes this too.