#!/usr/bin/env bash
set -e
cd /Users/akashkotaraju/told-you-so/DemoScripts
A=assets
VENC="-c:v libx264 -profile:v high -preset veryfast -crf 20 -pix_fmt yuv420p"
AENC="-c:a aac -b:a 160k -ar 48000"

# Card + voiceover (padded with silence to section length): png vo secs out
mkcard() {
  ffmpeg -y -loop 1 -framerate 30 -t "$3" -i "$1" -i "$2" \
    -filter_complex "[0:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p[v];[1:a]aresample=48000,apad[a]" \
    -map "[v]" -map "[a]" -t "$3" $VENC $AENC "$4"
}

# Recording sped by factor to fit section, with voiceover: in vo factor secs out
mkrec() {
  ffmpeg -y -i "$1" -i "$2" \
    -filter_complex "[0:v]setpts=PTS/$3,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[v];[1:a]aresample=48000,apad[a]" \
    -map "[v]" -map "[a]" -t "$4" $VENC $AENC "$5"
}

echo "== title =="
mkcard "$A/title.png" vo/intro.aiff 8 seg_title.mp4
echo "== part1 (ingest) 4:00 -> 62s =="
mkrec part1.mov vo/ingest.aiff 3.884 62 seg_part1.mp4
echo "== part2 (objection) 5:30 -> 78s =="
mkrec part2.mov vo/objection.aiff 4.243 78 seg_part2.mp4
echo "== architecture =="
mkcard "$A/architecture.png" vo/arch.aiff 16 seg_arch.mp4
echo "== endcard =="
mkcard "$A/endcard.png" vo/close.aiff 9 seg_endcard.mp4

echo "== concat =="
printf "file 'seg_title.mp4'\nfile 'seg_part1.mp4'\nfile 'seg_part2.mp4'\nfile 'seg_arch.mp4'\nfile 'seg_endcard.mp4'\n" > concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy told-you-so-demo.mp4

echo "== DONE =="
ffprobe -hide_banner told-you-so-demo.mp4 2>&1 | grep -E "Duration|Stream"
du -h told-you-so-demo.mp4
