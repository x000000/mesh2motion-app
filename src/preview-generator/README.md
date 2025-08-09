# Preview Generator

The goal of this preview generator is to create small animated clip previews to use in the animation listing.



## Workflow

1. Background: Create a 3d setup scene that resembles what is in the application. Maybe we can reuse the Generator
2. Background: Load the human mesh skinned that includes all the animations and add to scene
2a. Background: specify video parameters like screen size, bitrate, and FPS 
3. Use the MediaRecorder API to record the 3d canvas
 -- Loop through each animation and record each animation. 
       a Start recording
       b Play animation clip
       c when animation clip ends, stop recording
       d save recording as animation_clip_x.webm to array somewhere
       e repeat to step a for each animation
       f when all the animations are done being recorded, save everything to a zip file and download