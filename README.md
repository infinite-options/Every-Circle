# Every-Circle

# Minimum when switching Credentials

rm -rf android or rm -rf ios
npx expo start --reset-cache
npx expo prebuild --clean (clean may reset Xcode settings like Team and Apple SignIn)
npx expo run

This might be cleaner (and less distruptive):
rm -rf android  
 npx expo prebuild  
 npx expo run:android

NOTE: npx expo prebuild --clean is equivalent to rm -rf ios android & npx expo prebuild

# On iPhone Simulator

- Google Login
  - may need to Reset Device using Device > Erase all Contents and Settings
  - npx expo run:ios
- Apple Login
  - may need to check Team and Apple Sign in using Xcode

# Business Team Role Edit Rules

Role changes are edited on **Edit Business Profile → Team & Access**. Business Profile shows roles as read-only (no Change Role control).

**Senior roles** = Owner, Partner.  
**Draft session** = unsaved edits on Edit Business Profile. Viewer permissions are based on the **saved** role at page load; role dropdowns / trash visibility update from the **draft** roster.

## Who can add members (+)

```text
Viewer (saved role)   Can add?   Roles they can assign
--------------------  ---------  ---------------------------------------------
Owner                 Yes        Owner, Partner, Admin, Employee, Other
Partner               Yes        Owner, Partner, Admin, Employee, Other
Admin                 Yes        Admin, Employee, Other only
Employee / Other      No         (none)
```

## Who can edit a member's role (dropdown)

```text
Viewer (saved)        Target member (draft role)                   Can edit?
--------------------  -------------------------------------------  ---------
Owner / Partner       Self (any role, incl. Owner/Partner)       Yes
Owner / Partner       Other Owner / Partner                        Yes (draft; applied on Save)
Owner / Partner       Admin / Employee / Other                     Yes
Admin                 Owner / Partner                              No
Admin                 Self or Admin / Employee / Other             Yes
Employee / Other      Anyone                                       No
```

## Who can remove a member (trash icon)

Senior count includes existing members plus newly added Owner/Partner rows that have not been saved yet.

```text
Viewer (saved)              Target member (draft role)     Other Owner/Partner       Trash
                                                         in draft roster?
--------------------------  ---------------------------  ------------------------  -------
Owner / Partner             Self as sole Owner/Partner   No (senior count = 1)     Hidden
Owner / Partner             Self as Owner/Partner        Yes (senior count >= 2)   Visible
Owner / Partner             Other Owner / Partner        Yes (senior count >= 2)   Visible
Owner / Partner             Other Owner / Partner        No (zero seniors left)    Hidden
Owner / Partner             Admin / Employee / Other     n/a                       Visible
Admin / Employee / Other    Anyone                       n/a                       Hidden
```

## Save validation

```text
Draft roster after removals / role changes              Save allowed?
----------------------------------------------------  --------------
At least one Owner or Partner remains                 Yes
Members remain, but none are Owner or Partner         No — "Missing owner or partner"
No one left in Team & Access (see below)              Yes — FE allows; backend may reject
```

**No one left in Team & Access** means you removed every listed member (trash icon) and did not add any replacement email rows, so the draft roster is empty before Save. This is uncommon; the app does not require at least one member in that case, but the backend may still reject the update.

Backend may still reject some role/membership updates (`protected` / `forbidden` / `not_found`); those are shown in alerts after Save.
