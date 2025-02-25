<p align="center"><img src="https://socialify.git.ci/Yonokid/AmuseQueue/image?language=1&name=1&owner=1&pattern=Transparent&stargazers=1&theme=Dark" style="width: 50%; height=50%;"></p>

<p align="center" id="description">A live queue interface for arcade machines.</p>

<h2>Demo</h2>

[https://amuse-queue-d79174ba0b42.herokuapp.com/](https://amuse-queue-d79174ba0b42.herokuapp.com/)

<h2>Project Screenshots:</h2>

<img src="https://files.catbox.moe/cfh7wz.png" alt="project-screenshot" width="400" height="200/">

<img src="https://files.catbox.moe/bsgsea.png" alt="project-screenshot" width="200" height="400/">

  
  
<h2>Features</h2>

Here're some of the project's best features:

*   Websocket based live queue
*   Double queue system for 2 player games
*   Configurable store settings
*   Live operator access
*   Kiosk mode with auto generating QR code for quick access

<h2>Installation Steps:</h2>

<p>1. Install project requirements</p>

```
pip install -r requirements.txt
```

<p>2. (Windows only) Enable debug</p>

```
in __init__.py debug = True
```

<p>3. Run with flask</p>

```
flask run
```
