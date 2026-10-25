# Vel IDE Bridge for Visual Studio Code

This small companion extension opens the local IDE and copies the active `.vel` or `.html` file into a chosen IDE workspace. It never overwrites an existing file. It does not connect Microsoft Visual Studio or install other VS Code extensions into Vel.

Start the VEL IDE server first. To try the extension in VS Code, open this directory and launch an extension development window from a shell:

```
code --extensionDevelopmentPath="ABSOLUTE_PATH_TO_THIS_DIRECTORY"
```

In that development window, use the Command Palette:

- **Vel: Open Local IDE**
- **Vel: Send Active File to IDE**

The configurable `vel.serverUrl` must point to the local server. Refresh the Vel IDE explorer after copying a file. To distribute a VSIX, package this directory using Microsoft's `@vscode/vsce` tooling; the VSIX is not prebuilt here.
