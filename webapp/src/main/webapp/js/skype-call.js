/**
 * Skype Call application (web page). This script initializes an UI of a page that will handle a particular Skype call.
 */
if (eXo.videoCalls) {
	(function(videoCalls) {
		"use strict";

		var skype = videoCalls.getProvider("skype");
		if (skype) {
			// 
			var hasToken = /#access_token=/.test(location.hash);
			var hasError = /#error=/.test(location.hash);
			var isLogin = /\?call=/.test(location.search);
			var isCall = /\/_call_/.test(location.pathname);
			// var isLogin = !isCall;

			/** For debug logging. */
			var objId = Math.floor((Math.random() * 1000) + 1);
			var logPrefix = "[skypeapp_" + objId + "] ";
			function log(msg, e) {
				if (typeof console != "undefined" && typeof console.log != "undefined") {
					console.log(logPrefix + msg);
					if (e && typeof e.stack != "undefined") {
						console.log(e.stack);
					}
				}
			}

			function getParameterByName(name, url) {
				if (!url) {
					url = window.location.href;
				}
				name = name.replace(/[\[\]]/g, "\\$&");
				var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
				if (!results)
					return null;
				if (!results[2])
					return '';
				return decodeURIComponent(results[2].replace(/\+/g, " "));
			}

			// var initializer = $.Deferred();
			function listener(event) {
				var origin = event.origin || event.originalEvent.origin;
				if (origin.startsWith(videoCalls.getBaseUrl() + "/portal/intranet/skype")) {
					// initializer.resolve(event.data);
				} else {
					console.log("Ignoring not known message to " + location);
				}
			}
			// if (window.addEventListener) {
			// addEventListener("message", listener, false);
			// } else {
			// attachEvent("onmessage", listener);
			// }

			$(function() {
				var clientId = skype.getClientId();
				if (isLogin) {
					// it's login page
					log("Skype login >>>");
					if (!hasToken && !hasError) {
						var redirectUri = location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "")
									+ location.pathname + "/_call_" + location.search.substring(6);
						location.assign('https://login.microsoftonline.com/common/oauth2/authorize?response_type=token&client_id='
									+ clientId + '&redirect_uri=' + redirectUri + '&resource=https://webdir.online.lync.com');
					}
					// show the UI if the user has signed in
					if (hasToken) {
						// Use Skype Web SDK to start signing in
						// skype.application().done(function(app) {
						// // TODO save token in the server-side for late use
						// console.log("Skype app created OK, token: " + location.hash);
						// });
					}
					if (hasError) {
						log("Skype login error: " + location.hash);
					}
					log("<<< Skype login");
				} else if (isCall) {
					log("Skype call " + location.href + " >>>");
					// it's call window, user may be already authenticated, but may be not
					var uiInitializer = skype.uiApplication(location.href);
					uiInitializer.done(function(api, uiApp) {
						// render the call CC
						log("Skype app created OK, user: " + uiApp.personsAndGroupsManager.mePerson.displayName());
						// initializer.done(function(context) {
						// if (!context) {
						// context = {
						// participants : getParameterByName("call").split(";")
						// };
						// }
						try {
							var participants = location.pathname.substring(location.pathname.indexOf("_call_") + 6).split(";")
							// //
							for (var i = 0; i < participants.length; i++) {
								var p = participants[i];
								var personSearchQuery = uiApp.personsAndGroupsManager.createPersonSearchQuery();
								personSearchQuery.text(p);
								personSearchQuery.limit(5);
								personSearchQuery.getMore().then(function(results) {
									results.forEach(function(result) {
										var person = result.result;
										log("Person: " + p + " " + person.displayName());
									}, function(err) {
										log("Search person error: " + p, err);
									});
								});
							}
							// //
							var $convo = $("#skype-call-conversation");
							if ($convo.size() == 0) {
								var $container = $("<div class='skype-call-container'></div>");
								$(document.body).append($container);
								$convo = $("<div id='skype-call-conversation'></div>");
								$container.append($convo);
								var newHeight = $(window).height();
								var oldHeight = $container.height();
								if (newHeight > oldHeight) {
									$container.height(newHeight);
								}
							}
							$("#UIWorkingWorkspace").hide();
							log("Skype conversation is creating in " + $convo.get(0) + " participants: " + participants.join(","));
							api.renderConversation($convo.get(0), {
								"modalities" : [ "Video" ], // , 'Video'
								"participants" : participants
							}).then(function(conversation) {
								// Conversation Control was rendered successfully
								log("Skype conversation rendered successfully >>>> " + JSON.stringify(conversation));
								// Add additional listeners for changes to conversation state here (see below section)
								// conversation.chatService.start().then(function() {
								// // chatService started successfully
								// log("Skype chatService started successfully");
								// }, function(err) {
								// log("Skype error starting chatService " + err);
								// });
							}, function(err) {
								// error rendering Conversation Control
								if (err.name && err.message) {
									log("Skype conversation rendering error >>>> " + err.name + " " + err.message, err);
								} else {
									log("Skype conversation rendering error >>>> " + JSON.stringify(err));
								}
							});
							// });
						} catch (err) {
							log("Skype call error >>>> ", err);
						}
					});
					uiInitializer.fail(function(err) {
						// TODO we have an error, check if it's auth problem, then force to login
						log("Skype app error: " + err);
					});
					log("<<< Skype call");
				}
			});
		}
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for skype-call.js");
}
