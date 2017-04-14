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
			var isCall = /\/_/.test(location.pathname);
			var isLogin = /\/login/.test(location.pathname);

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

			function addToContainer($content) {
				var $container = $("div.skype-call-container");
				if ($container.length == 0) {
					$container = $("<div class='skype-call-container' style='display: none;'></div>");
					var newHeight = $(window).height();
					var oldHeight = $container.height();
					if (newHeight > oldHeight) {
						$container.height(newHeight);
					}
					$(document.body).append($container);
				}
				$container.append($content);
				$container.show();
			}

			function decodeMessage(msg) {
				var dmsg = decodeURIComponent(msg);
				return dmsg.replace(/\+/g, " ");
			}

			function handleError() {
				var $error = $("#skype-call-error");
				if ($error.length == 0) {
					$error = $("<div id='skype-call-error'></div>");
					addToContainer($error);
				}
				var hasharr = location.hash.substr(1).split("&");
				hasharr.forEach(function(hashelem) {
					var elemarr = hashelem.split("=");
					if (elemarr[0] == "error") {
						var $title = $("<h1 class='error-title'></h1>");
						$title.text(decodeMessage(elemarr[1]));
						$error.append($title);
					} else if (elemarr[0] == "error_description") {
						var $description = $("<div class='error-description'></div>");
						$description.text(decodeMessage(elemarr[1]));
						$error.append($description);
					} else {
						var $extrainfo = $("<div class='error-extrainfo'></div>");
						$extrainfo.text(decodeMessage(elemarr[0]) + ": " + decodeMessage(elemarr[1]));
						$error.append($extrainfo);
					}
				}, this);
			}

			// // TODO Browser Listener - used for debug purposes (WebSDK sends tonds of messages to itself window)
			// function listener(event) {
			// var origin = event.origin || event.originalEvent.origin;
			// //if (origin.startsWith(videoCalls.getBaseUrl() + "/portal/skype/call")) {
			// // initializer.resolve(event.data);
			// //} else {
			// // log("Ignoring not known message to " + location + " from " + origin + " data: ");
			// //}
			// log("Message to " + location + " from " + origin + " data: " + JSON.stringify(event.data));
			// }
			// if (window.addEventListener) {
			// addEventListener("message", listener);
			// } else {
			// attachEvent("onmessage", listener);
			// }
			// //

			$(function() {
				var clientId = skype.getClientId();
				log(">> Skype " + location.href);
				if (isLogin) {
					// FYI it's what WebSDK calls an "empty page"
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
						handleError();
					}
					log("<<< Skype login");
				} else if (isCall) {
					log(">>> Skype call " + location.href);
					// it's call window, user may be already authenticated, but may be not
					if (hasToken) {
						var redirectUri = videoCalls.getBaseUrl() + "/portal/skype/call/login";
						// + location.pathname;
						var uiInitializer = skype.uiApplication(redirectUri);
						uiInitializer.done(function(api, uiApp) {
							// render the call CC
							log(">>>> Skype app created OK, user: " + uiApp.personsAndGroupsManager.mePerson.displayName());
							try {
								var participants = decodeURIComponent(
											location.pathname.substring(location.pathname.indexOf("call/_") + 6)).split(";")
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
									$convo = $("<div id='skype-call-conversation'></div>");
									addToContainer($convo);
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
						handleError();
					}
					log("<<< Skype call");
				} else {
					log(">>> Skype default page " + location.href);
					var hasIdToken = /#id_token=/.test(location.hash);
					if (hasIdToken && location.hash.indexOf("admin_consent=True") >= 0) {
						log(">>>> Skype admin consent: " + location.hash);
						var $root = $("#skype-call-root");
						if ($root.length == 0) {
							$root = $("<div id='skype-call-root'></div>");
							addToContainer($root);
						}
						var $title = $("<h1 class='consent-success'></h1>");
						$title.text("Success");
						$root.append($title);
						var $description = $("<h3 class='consent-description'></h3>");
						$description.text("Successfully granted app with Admin Consent");
						$root.append($description);
						var hasharr = location.hash.substr(1).split("&");
						hasharr.forEach(function(hashelem) {
							var elemarr = hashelem.split("=");
							var $info = $("<div class='consent-info'></div>");
							$info.text(decodeMessage(elemarr[0]) + ": " + decodeMessage(elemarr[1]));
							$root.append($info);
						}, this);
						addToContainer($("<p><a href='/portal'>Home</a></p>"));
					}
					if (hasToken) {
						log(">>>> Skype token: " + location.hash);
						var $root = $("#skype-call-root");
						if ($root.length == 0) {
							$root = $("<div id='skype-call-root'></div>");
							addToContainer($root);
						}
						$root.text("Skype Calls default page. Please go to Portal Home and start a call from there.");
						addToContainer($("<div><a href='/portal'>Home</a></div>"));
					}
					if (hasError) {
						log(">>>> Skype error: " + location.hash);
						handleError();
					}
					log("<<< Skype default page");
				}
			});
		} else {
			console.log("Skype provider not found for skype-call.js");
		}
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for skype-call.js");
}
