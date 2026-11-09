"""SoftwareApplication and VideoObject nodes for tools/structured_data.py.

Inputs are the tool records in discover.json and the video records in
system/videos.json. Nothing here invents a value: a field absent from the
record is absent from the node.
"""
from __future__ import annotations

AUTHOR = {"@id": "https://harperz9.github.io/#person", "@type": "Person", "name": "Zain Dana Harper"}


def application_node(tool: dict, url: str) -> dict:
    """The released tool as an installable application, version and licence included."""
    node = {
        "@type": "SoftwareApplication", "@id": f"{url}#application", "name": tool["name"],
        "url": url, "softwareVersion": tool["version"], "applicationCategory": tool["category"],
        "operatingSystem": tool["os"], "downloadUrl": tool["downloadUrl"], "license": tool["license"],
        "author": dict(AUTHOR), "isAccessibleForFree": True,
        "sameAs": f"https://github.com/HarperZ9/{tool['repo']}",
    }
    if tool.get("install"):
        node["installUrl"] = tool["downloadUrl"]
    return node


def video_node(video: dict) -> dict:
    node = {"@type": "VideoObject", "@id": f"{video['contentUrl']}#video", "name": video["name"],
            "description": video["description"], "contentUrl": video["contentUrl"],
            "uploadDate": video["uploadDate"], "author": dict(AUTHOR)}
    for key in ("thumbnailUrl", "duration"):
        if video.get(key):
            node[key] = video[key]
    return node
