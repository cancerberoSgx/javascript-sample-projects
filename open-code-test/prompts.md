I want to create a full stack project in this empty folder:

 * docker compose for local development with postgres, backend api, and frontend 
 * put this in /docker folder

backend: 
 * put this in /backend folder
 * python fastapi
 * login with jwt
 * a repository (db), services and endpoints code layers

db: 
 * use sql migration files to add / modify db . Always use pure sql code
 * organizations with names 
 * users with email, passwords and role (member, root) 

frontend:
 * use react, react-router, typescript, vite, tailwind
 * login with user and password
 * root users can Crud organizations, and can perform all the actions on any organization
 * organization users crud (both member and root roles)

do you have any questions before start ?


# root impersonate
now a root user can impersonate a member user from the user's list

# documents & folders
The objectivfe is to have a file system with folders and files in the db per organizatoin
an organization can have multiple "drives" and drives can have mutiple folders and files
user can CRUD drives
user can crud files and folders in a drive
for now we'll only support files of type "plain text" with text area  editor
user edit the contents of a file
users can rename folders and files
users can create folders in their organization
users can create file in a folder
user can move a file to a different folder using drag and drop in the tree
right click on file or folder with dropdown options for rename
double click or "enter" on selected folder
users can multiple select folders & files and copy their reference and paste it in another  folder.

files and folders will be stored in db, both their metadata like name or type but also their content. 
the idea is to have db filessystem with an easy to use UI
do you have any questions before proceeding ? 

tasks:

 * drive files must also support binary files, since we plan to store any kind of file
 * user can upload a .zip file to a folder which will be decompressed and stored as sub files
 * image and image viewer: identify common image formats and when user opens it shows an image viewer with zoom and span capabilities


# tests
in folder /tests add pytests for all the API level operations. Using the same DB tests should be able to create new orgs, new folders and files, tests endpoints and permissions, features and when finished clean up created resources. add instructions so in future features we also add tests like this. backend api integration tests

