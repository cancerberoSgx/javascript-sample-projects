I want to try egui using python, probably pyegui
create in this folder a project using pyegui which display a minimal interactive UI
in readme add instructions on how to run it for local development and how to generate binaries


move main.py code to an src/example.py file
create a src/image-viewer/ screen / app which:
 * allows to load png and jpeg images (and other common formats if they come out of the box to minimze library dependencies)
 * once an image is loaded allows to "draw" bu clickin g& draggin over it. User is able to pick a color and a "pencil width"
 * allows to apply some transformations such as convolutions blur, flat, edge detection
 * allows to resize the image with a dialog displaying current width and height and user being able to edit them. 
 * allows to "clip" n image, this is selecting part of the image dragging a rectangle and the image will be replaced with that selected part.
make main.py to point to that image-viewer app. In the future i will create other app examples in other folders of the source and be able to easily test them via main.py - I'm just testing the library here, don't mind to have different dependencies installed on the same project 
