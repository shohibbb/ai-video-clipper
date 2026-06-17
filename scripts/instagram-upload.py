#!/usr/bin/env python3
"""
Instagram upload script via Composio Python SDK.
Called from Node.js API route as a child process.

Usage:
    python instagram-upload.py <json_args>
    Args JSON: {"entity_id":"shohib","ig_user_id":"...","video_url":"...","caption":"...","share_to_feed":true}
"""

import json
import os
import sys
import traceback


def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"success": False, "error": "No arguments provided"}))
            sys.exit(1)

        args = json.loads(sys.argv[1])
        entity_id = args.get("entity_id", "shohib")
        ig_user_id = args.get("ig_user_id", "")
        video_url = args.get("video_url", "")
        caption = args.get("caption", "")
        share_to_feed = args.get("share_to_feed", True)

        if not video_url:
            print(json.dumps({"success": False, "error": "video_url is required"}))
            sys.exit(1)

        if not ig_user_id:
            print(json.dumps({"success": False, "error": "ig_user_id is required"}))
            sys.exit(1)

        api_key = os.environ.get("COMPOSIO_API_KEY", "")
        if not api_key:
            print(json.dumps({"success": False, "error": "COMPOSIO_API_KEY is required"}))
            sys.exit(1)

        os.environ["COMPOSIO_API_KEY"] = api_key

        from composio import Composio

        composio = Composio(toolkit_versions={"INSTAGRAM": "20260501_00"})

        # Step 1: Create media container
        create_result = composio.tools.execute(
            "INSTAGRAM_POST_IG_USER_MEDIA",
            user_id=entity_id,
            arguments={
                "ig_user_id": ig_user_id,
                "video_url": video_url,
                "media_type": "REELS",
                "caption": caption,
                "share_to_feed": share_to_feed,
            },
        )

        if not create_result.get("successful"):
            error_msg = create_result.get("error") or "Failed to create Instagram media container"
            print(json.dumps({"success": False, "error": error_msg}))
            sys.exit(1)

        creation_id = create_result.get("data", {}).get("id")
        if not creation_id:
            print(json.dumps({"success": False, "error": "No container ID returned"}))
            sys.exit(1)

        # Step 2: Publish the container (with auto-wait for video processing)
        publish_result = composio.tools.execute(
            "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
            user_id=entity_id,
            arguments={
                "ig_user_id": ig_user_id,
                "creation_id": creation_id,
                "max_wait_seconds": 300,
            },
        )

        if not publish_result.get("successful"):
            error_msg = publish_result.get("error") or "Failed to publish Instagram media"
            print(json.dumps({"success": False, "error": error_msg, "container_id": creation_id}))
            sys.exit(1)

        media_id = publish_result.get("data", {}).get("id", "")
        print(json.dumps({
            "success": True,
            "container_id": creation_id,
            "media_id": media_id,
        }))

    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"success": False, "error": str(e), "traceback": tb[-500:]}))
        sys.exit(1)


if __name__ == "__main__":
    main()
