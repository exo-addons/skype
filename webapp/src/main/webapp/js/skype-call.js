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
			var isStart = /\?call=/.test(location.search);
			var isCall = /\/_call_/.test(location.pathname);
			var isLogin = /\/login/.test(location.pathname);
			var isSignin = /\/signin/.test(location.pathname);

			/** For debug logging. */
			var objId = Math.floor((Math.random() * 1000) + 1);
			var logPrefix = "[skypecall_" + objId + "] ";
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

			if (isSignin) {
				location.assign(location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "")
							+ "/portal");
			}

			$(function() {
				var clientId = skype.getClientId();
				if (isStart) {
					// it's login page
					log("Skype call start >>>");
					if (!hasToken && !hasError) {
						// TODO need more robust way of state-less URI building to avoid too long links for multi-user calls (e.g.
						// in spaces).
						// 1) user browser storage between initial call and the redirect
						// 2) use server-side (REST) for temporal store of the call info (participants, name etc)
						var redirectUri = location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "")
									+ location.pathname + "/_call_" + location.search.substring(6);
						location.assign("https://login.microsoftonline.com/common/oauth2/authorize?response_type=token&client_id="
									+ clientId + "&redirect_uri=" + encodeURIComponent(redirectUri) + "&resource="
									+ encodeURIComponent("https://webdir.online.lync.com"));
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
					log("<<< Skype call start");
				} else if (isLogin) {
					log(">>> Skype login");
					if (hasToken) {
						log(">>>> Skype login token: " + location.hash);
						// TODO do we need this?
						// Use Skype Web SDK to start signing in
						// var appInitializer = skype.application(redirectUri);
						// appInitializer.done(function(api, app) {
						// // TODO save token in the server-side for late use
						// log(">>>> Skype login OK, app created OK, token: " + location.hash);
						// });
						// appInitializer.fail(function(err) {
						// log(">>>> Skype login error: " + err);
						// });
					}
					if (hasError) {
						log("Skype login error: " + location.hash);
					}
					log("<<< Skype login");
				} else if (isCall) {
					log(">>> Skype call " + location.href);
					// it's call window, user may be already authenticated, but may be not
					if (hasToken) {
						var redirectUri = location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "")
									+ "/portal/skype/call/login";
						// + location.pathname;
						var uiInitializer = skype.uiApplication(redirectUri);
						uiInitializer.done(function(api, uiApp) {
							// render the call CC
							log(">>>> Skype app created OK, user: " + uiApp.personsAndGroupsManager.mePerson.displayName());
							try {
								var participants = decodeURIComponent(
											location.pathname.substring(location.pathname.indexOf("_call_") + 6)).split(";")
								// TODO was for debug purpose only
								// for (var i = 0; i < participants.length; i++) {
								// var p = participants[i];
								// var personSearchQuery = uiApp.personsAndGroupsManager.createPersonSearchQuery();
								// personSearchQuery.text(p);
								// personSearchQuery.limit(5);
								// personSearchQuery.getMore().then(function(results) {
								// results.forEach(function(result) {
								// var person = result.result;
								// log("Person: " + p + " " + person.displayName());
								// }, function(err) {
								// log("Search person error: " + p, err);
								// });
								// });
								// }
								var $convo = $("#skype-call-conversation");
								if ($convo.length == 0) {
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
								log(">>>> Skype conversation is creating in " + $convo.get(0) + " participants: "
											+ participants.join(","));
								api.renderConversation($convo.get(0), {
									"modalities" : [ "Chat", "Video" ], // 
									"participants" : participants
								}).then(function(conversation) {
									// Conversation Control was rendered successfully
									log(">>>> Skype conversation rendered successfully: " + JSON.stringify(conversation));
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
										log(">>>> Skype conversation rendering error: " + err.name + " " + err.message, err);
									} else {
										log(">>>> Skype conversation rendering error: " + JSON.stringify(err));
									}
								});
								// });
							} catch (err) {
								log(">>>> Skype call error:", err);
							}
						});
						uiInitializer.fail(function(err) {
							// TODO we have an error, check if it's auth problem, then force to login
							log(">>>> Skype app error: " + err);
						});
					}
					if (hasError) {
						log(">>>> Skype call error: " + location.hash);
					}
					log("<<< Skype call");
				} else {
					log(">>> Skype ???");
					if (hasToken) {
						log(">>>> Skype ??? token: " + location.hash);
					}
					if (hasError) {
						log(">>>> Skype ??? error: " + location.hash);
					}
					log("<<< Skype ???");
				}
			});
		} else {
			console.log("Skype provider not found for skype-call.js");
		}
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for skype-call.js");
}
