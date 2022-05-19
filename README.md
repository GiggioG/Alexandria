# Alexandria
"Backs up" files from the internet : allows taking snapshots and looking at past ones.
# **WARNING: SNAPSHOTS ARE NOT AUTOMATIC - A USER HAS TO TAKE THEM MANUALLY**
## Installation guide
1. `git clone` the repo and run `npm i` to install the dependencies
2. create a `config.json` file in the directory and type this in it:
```json
{
  "port" : 8080
}
```
(replace the `8080` with your prefered port)

3.If you want to access it from a device, different from your computer, but on the same network, first **find your local IP address.**  
If you want it open to the internet, find info about how to do that (port-forward or something similar), then **find your public IP address.**  
If you want to access the interface from your own device, then use **"localhost"**.  
Finally, open the interface on `http://<address>:<port>`.
## Interface overview
### Main page
It lists all of the files on this instance and allows you to open either:
  * the latest snapshot, by clicking on the file name
  * the files' [file info page](#file-info-page), by clicking `(Info)`

for each one. There is also a `Pick Random` button, which opens a random file's latest snapshot.
### File info page
Every file on an Alexandria instance has one, located on `http://<address>:<port>/file?id=<file id>`.
It Has links to the source of the file and to all its snapshots ("Versions").  
There are buttons for **Deleting**, **Renaming** and **Updating**(fetching a new snapshot) the file.
### Search page
Allows you to search the files on the instance. You can search by **File ID(UUID)**, **File name** or **File source**. The search is case-insensitive.
This page also has an `Open Random` button, which chooses a random result and opens it.
### Add file page
On this page you add files to your Alexandria instance. You need to specify a name and a url (only supports `http://` and `https://` schemes).
When you create a file, it automatically creates the first snapshot ("Version"). 
**REMEMBER [THIS](#warning-snapshots-are-not-automatic---a-user-has-to-take-them-manually) DISCLAIMER**