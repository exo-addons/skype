Skype add-on
================

Integrate Skype into eXo Platform. 
When user profile contains an IM with Skype or Skype for Business ID, it will be used for making a video call with the user.

## Installation

Use eXo Add-ons manager:

    ./addon install exo-skype
    
To install early access versions (milestones like 1.0.0-M01)
    
    ./addon install exo-skype --unstable
    
## Usage

Add-on will be activated only if currently logged user has Skype or Skype for Business account in his profile and others have such account(s). A call button will appear on user profile page, on his pane in connections of others, in user popovers of activity stream. User can have several IM account, then the call button will have a dropdown to choose from these accounts.



