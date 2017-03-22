/**
 * Skype Call application (Juzu portlet for handling a call) in eXo Platform. This script initializes an UI of a page
 * that will handle a particular Skype call (invoked from videoCalls/videoCalls_skype script).
 */
require([ "SHARED/jquery", "SHARED/videoCalls", "SHARED/videoCalls_skype" ], function($, videoCalls, skype) {
	"use strict";

	var hasToken = /#access_token=/.test(location.hash);
	var hasError = /#error=/.test(location.hash);
	var isLogin = /\?login/.test(location.search);
	var isCall = /\?call=/.test(location.search);

	function getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
	}
	
	var initializer = $.Deferred();
	function listener(event) {
		var origin = event.origin || event.originalEvent.origin;
		if (origin.startsWith(videoCalls.getBaseUrl() + "/portal/intranet/skype")) {
			initializer.resolve(event.data);
		} else {
			console.log("Ignoring not known message to " + location);
		}
	}
	if (window.addEventListener) {
		addEventListener("message", listener, false);
	} else {
		attachEvent("onmessage", listener);
	}

	$(function() {
		// wait for the opener window if one
		setTimeout(function() {
			initializer.resolve();
		}, 1500);

		// redirect to Org ID if there is no token in the URL
		var clientId = skype.getClientId();
		if (isLogin) {
			// it's login page
			console.log("Skype login >>>");
			if (!hasToken && !hasError) {
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
			uiInitializer.done(function(api, uiApp) {
				// render the call CC
				console.log("Skype app created OK, user: " + uiApp.personsAndGroupsManager.mePerson.displayName);
				initializer.done(function(context) {
					if (!context) {
						context = {
							participants : getParameterByName("call").split(";") 
						};
					}
					var $convo = $("#skype-call-conversation");
					api.renderConversation("#skype-call-conversation", {
						modalities : [ 'Chat', 'Video' ],
						participants : context.participants
					}).then(function(conversation) {
						// Conversation Control was rendered successfully
						console.log("Skype call rendered successfully >>>>");
						// Add additional listeners for changes to conversation state here (see below section)
						// conversation.chatService.start().then(function() {
						// // chatService started successfully
						// }, function(error) {
						// // error starting chatService
						// });
					}, function(err) {
						// error rendering Conversation Control
						console.log("Skype call rendering error >>>> " + err);
					});
				});
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
