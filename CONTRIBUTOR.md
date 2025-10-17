# Contributor Guide

This is a work in progress document to help point people that might be interested in helping out.

TODO: Make a template file to start. That will remove steps 2-8

## Creating Animations from rig file

The skeletons need to be compatible with the the web applicatoin. There are pre-rigged meshes ready to animate using Blender 4.5. These will make it very easy to add the animations to the application.

1. Download the 3d Blender rig file you want to help with
- [Bird Rig](https://github.com/scottpetrovic/mesh2motion-app/blob/main/static/blender/rigs/bird/rig-bird-v2.blend)
- [Human Rig](https://github.com/scottpetrovic/mesh2motion-app/blob/main/static/blender/rigs/human/rig-human.blend)
- [Dragon Rig](https://github.com/scottpetrovic/mesh2motion-app/blob/main/static/blender/rigs/dragon/rig-dragon-v2.blend)
- [Fox Rig](https://github.com/scottpetrovic/mesh2motion-app/blob/main/static/blender/rigs/fox/rig-fox-v2.blend)
2. Create a new Blender file and delete all the objects (meshes, camera, lights) that exist in the scene
3. Go to the main menu option File > Link
4. Find the rig file you just downloaded. Double click the blend file. This will allow us to link/import the rig.  
5. Go into the "Collection" folder. Select all the files in there (will have two collections) and click the Link button to import.
6. Hide the custom bone shapes collection from the scene outline
7. Select the rig and go to the 3d viewport option Object > Library Override > Make
8. Select the skeleton and go into Pose mode.

From here you can create the animation. I usually use the action editor. The project currently contains one animation per Blender file.

## Sharing final animation file

Once your animation is done, you can create a new Github ticket and attach your Blender file with a note with what you have done.











