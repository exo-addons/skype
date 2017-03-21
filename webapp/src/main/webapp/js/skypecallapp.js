/**
 * Skype Call application (Juzu portlet for handling a call) in eXo Platform. This script initializes an UI of a page
 * that will handle a particular Skype call (invoked from videoCalls/videoCalls_skype script).
 */
require([ "SHARED/jquery", "SHARED/videoCalls", "SHARED/videoCalls_Skype" ], function($, videoCalls, skype) {

	var hasToken = /#access_token=/.test(location.hash);
	var hasError = /#error=/.test(location.hash);
	var isLogin = /\?login/.test(location.search);
	var isCall = /\?call=/.test(location.search);

	$(function() {
		// redirect to Org ID if there is no token in the URL
		if (isLogin) {
			// it's login page
			console.log("Skype login >>>");
			if (!hasToken && !hasError) {
				var clientId = skype.getClientId();
				location.assign('https://login.microsoftonline.com/common/oauth2/authorize?response_type=token' + '&client_id='
							+ clientId + '&redirect_uri=' + location.href + '&resource=https://webdir.online.lync.com');
			}
			// show the UI if the user has signed in
			if (hasToken) {
				// Use Skype Web SDK to start signing in
				skype.application().done(function(app) {
					// TODO save token in the server-side for late use
					console.log("Skype app created OK, token: " + +location.hash);
				});
			}
			if (hasError) {
				console.log("Skype login error: " + location.hash);
			}
			console.log("<<< Skype login");
		} else if (isCall) {
			console.log("Skype call " + location.search + " >>>");
			// it's call window, user may be already authenticated, but may be not
			var uiInitializer = skype.uiApplication();
			uiInitializer.done(function(uiApp) {
				// TODO render the call CC
				console.log("Skype app created OK, user: " + uiApp.personsAndGroupsManager.mePerson.displayName);
			});
			uiInitializer.fail(function(err) {
				// TODO we have an error, check if it's auth problem, then force to login
				console.log("Skype app error: " + err);
			});
			console.log("<<< Skype call");
		}
	});

	return {
		stop : function() {
			// TODO?
		}
	};
});
