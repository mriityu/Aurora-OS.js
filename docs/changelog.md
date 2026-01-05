---
description: Version history and guidance
icon: arrows-rotate-reverse
---

# Changelog

{% updates format="full" %}
{% update date="2026-01-06" %}
## v0.8.1

Added functional Mail app and adapted the system to accommodate.

<details>

<summary>Added</summary>

* **Mail App**: Added mail app with basic functionality, to be further enhanced by gameplay logic and features in 0.9.x (just like Messages app should be enhanced by gameplay logic and features in 0.9.x).

</details>

<details>

<summary>Improved</summary>

* **Apps Main Menu**: Standardized to be included in \[app].tsx files.
* **System States**: Improved the restart/log-out/shutdown logic.
* **Apps**: Added user context to apps, so they can access user-specific data (eg. user specific home directory, user specific downloads directory, etc.)

</details>

<details>

<summary>Fixed</summary>

* **Terminal App**: Fixed issue with terminal app retaining history even after a hard wipe - it should persist only in case of a crash.

</details>

<details>

<summary>Know issues</summary>

* Had to regres `react-day-picker` to 8.10.1 as 9.13.0 was newer than the requirement of shadcn library (that we depend of) and broke the functionality.

No other new known issues reported in this release. You can contribute to the next release by [oppening an Issue](https://github.com/mental-os/Aurora-OS.js/issues) on the official [Aurora OS.js GitHub repository](https://github.com/mental-os/Aurora-OS.js).

</details>
{% endupdate %}

{% update date="2026-01-05" %}
## v0.8

Onboarding experience upon "New Game", core apps functional without placeholders, localization support.

<details>

<summary>Added</summary>

* **Onboarding Wizard**: A new "First Run Experience" (OOBE) that guides users through Language selection, Admin Account creation, and personalization.
* **User Management**: "Users & Groups" settings now support creating, deleting, and editing users (including Admin role toggle).
* **Admin Privileges**: Strict permission model where only `root` or `admin` group members can manage users.
* **Localization (i18n)**: Added foundational support for multi-language interfaces (i18next), starting with English.
* **App Store**: Added install feedback with progress bar dependant of app size and (future) installed hardware.

</details>

<details>

<summary>Improved</summary>

* **Storage Architecture**: Standardized system language persistence using `STORAGE_KEYS.LANGUAGE` (survives soft resets).
* **Build Optimization**: Configured Electron to only bundle necessary locales (`en`) to reduce package size.
* **Boot Sequence**: Fixed duplicate boot glitch and cleaned up the initial boot flow.
* **Ghost Directories**: Resolved the issue where `/home/user` was incorrectly created even when that user didn't exist.
* **Security**: `addUserToGroup` now correctly syncs between user objects and group lists.
* **Terminal**: Command history and visible output are now preserved while the user is still logged in (saves in case of crash).
* **Apps**: Apps now show size.

</details>

<details>

<summary>Know issues</summary>

* Had to regres `react-day-picker` to 8.10.1 as 9.13.0 was newer than the requirement of shadcn library (that we depend of) and broke the functionality.

No other new known issues reported in this release. You can contribute to the next release by [oppening an Issue](https://github.com/mental-os/Aurora-OS.js/issues) on the official [Aurora OS.js GitHub repository](https://github.com/mental-os/Aurora-OS.js).

</details>
{% endupdate %}

{% update date="2026-01-04" %}
## v0.7.9

Added functional Calendar app and adapted the system to accommodate.

<details>

<summary>Added</summary>

* **Calendar App:** with core functionality of adding, removing, and modifying an event. Calendar is one of the first apps that are file dependent, to enhance gameplay. It uses and references \~/.config/calendar.json to create hackable moments.
* CONTRIBUTION.md, CONTRIBUTORS.md

</details>

<details>

<summary>Improved</summary>

* **UI Immersion:** Text is now not selectable by default, except input area such as text area and fields.
* **Apps responsive design:** The sidebar of the apps uses a new way to determine if it requires the condensed or the relaxed variation of it based on the app window width.
* **Notifications:** Instead of the debugging "toast" we use the stylized notifications (success, warning, error).
* **Text highlight:** to follow accent color in input fields.
* **Agentic IDE:** Updated .gitignore to include .agent/rules/codeQuality.md that aims to create a base knowledge for code quality scans and future documentation (CODEBASE.md will be affected by this).
* **OPEN-SOURCE.md:** to reflect newest libs and dependences.

</details>

<details>

<summary>Removed</summary>

* **Videos App (placeholder):** Aurora OS.js experience won't include video files as game world element.
* **Videos Home Directory:** \~/Videos clean-up to not give users false impressions.

</details>

<details>

<summary>Know issues</summary>

* Had to regres `react-day-picker` to 8.10.1 as 9.13.0 was newer than the requirement of shadcn library (that we depend of) and broke the functionality.

No other new known issues reported in this release. You can contribute to the next release by [oppening an Issue](https://github.com/mental-os/Aurora-OS.js/issues) on the official [Aurora OS.js GitHub repository](https://github.com/mental-os/Aurora-OS.js).

</details>
{% endupdate %}

{% update date="2026-01-02" %}
## v0.7.8

UX quality of life enhancements for interacting with files visually.

<details>

<summary>Added</summary>

* **Multi-Selection:** Drag-selection and key-down selection support in both Finder and Desktop.
* **Smart User Provisioning:** New users (and Guest) now start with clean, empty home directories, while the default user retains sample content.

</details>

<details>

<summary>Improved</summary>

* **Grid Fluency:** Desktop grid logic improved for smoother icon snapping and collision handling.
* **Modern Standards:** Default support for ES2022 enhanced across the development environment.
* **Login Screen:** Polished UI consistency for user avatars and overall interface.

</details>

<details>

<summary>Fixed</summary>

* **Enhanced Drag & Drop:** Dragging multiple files between Finder and Desktop now works seamlessly.
* **App Store:** Permission issues when launching newly installed apps via Terminal resolved.
* **Music App:** Infinite scanning loops fixed and directory targeting improved (\~/Music or \~/).

</details>

<details>

<summary>Know issues</summary>

No new known issues reported in this release. You can contribute to the next release by [oppening an Issue](https://github.com/mental-os/Aurora-OS.js/issues) on the official [Aurora OS.js GitHub repository](https://github.com/mental-os/Aurora-OS.js).

</details>
{% endupdate %}
{% endupdates %}
