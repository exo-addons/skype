/**
 * Microsoft Skype for Business call application (web page). This script initializes an UI of a page that will handle a particular call.
 */
if (eXo.videoCalls) {
	(function(videoCalls) {
		"use strict";

		var mssfb = videoCalls.getProvider("mssfb");
		if (mssfb) {
			// 
			var hasToken = /#access_token=/.test(location.hash);
			var hasError = /#error=/.test(location.hash);
			var isCall = /\/_/.test(location.pathname);
			var isLogin = /\/login/.test(location.pathname);

			var isClosed = false;

			/** For debug logging. */
			var objId = Math.floor((Math.random() * 1000) + 1);
			var logPrefix = "[mssfbcall_" + objId + "] ";
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
				var $container = $("div.mssfb-call-container");
				if ($container.length == 0) {
					$container = $("<div class='mssfb-call-container' style='display: none;'></div>");
					var newHeight = $(window).height() - 30; // 15px for margins top/bottom
					var oldHeight = $container.height();
					if (newHeight > 0) {
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
				$("#mssfb-call-conversation").hide();
				var $error = $("#mssfb-call-error");
				if ($error.length == 0) {
					$error = $("<div id='mssfb-call-error'></div>");
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

			function showError(title, message) {
				$("#mssfb-call-conversation").hide();
				var $error = $("#mssfb-call-error");
				if ($error.length == 0) {
					$error = $("<div id='mssfb-call-error'></div>");
					addToContainer($error);
				}
				var $title = $("<h1 class='error-title'></h1>");
				$title.text(title);
				$error.append($title);
				var $description = $("<div class='error-description'></div>");
				$description.text(message);
				$error.append($description);
			}

			function onClosePage(conversation, uiApp) {
				if (!isClosed) {
					// TODO In WebKIT browsers this stuff doesn't work and outgoing call still may run for the remote party if
					// simply close the window. It is caused by the browser implementation, in WebKIT it doesn't let asynchronous
					// requests to work on this stage, but if user will click to stay(!) on the page, then this code will be
					// proceeded and the call ended.
					// In IE and FF (but not for video/audio in FF currently, Apr 26 2017), this code will be
					// executed by the browser and call rejected or stopped.
					log("<<<< Leave Skype conversation");
					conversation.leave().then(function() {
						uiApp.conversationsManager.conversations.remove(conversation);
						log("<<<< Skype conversation leaved");
						isClosed = true;
					});
					conversation.selfParticipant.reset();
					// conversation.videoService.stop();
					// conversation.audioService.stop();
					// conversation.chatService.stop();
					// uiApp.signInManager.signOut().then(function() {
					// log("<<<< Skype signed out");
					// }, function(error) {
					// log("<<<< Error signing out Skype:" + error);
					// });
					// var currentTime = new Date().getTime();
					// while (currentTime + 3000 >= new Date().getTime()) {
					// for (var i = 0; i++; i < 10) {
					// }
					// }
					// log("<<<< Skype signing out");
					return "You canceled the call";
				}
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
				var clientId = mssfb.getClientId();
				log(">> MSSFB " + location.href);
				if (isLogin) {
					// FYI it's what WebSDK calls an "empty page"
					log(">>> MSSFB login");
					if (hasToken) {
						log(">>>> MSSFB login token: " + location.hash);
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
						log("MSSFB login error: " + location.hash);
						handleError();
					}
					log("<<< MSSFB login");
				} else if (isCall) {
					log(">>> MSSFB call " + location.href);
					// it's call window, user may be already authenticated, but may be not
					if (hasToken) {
						var redirectUri = videoCalls.getBaseUrl() + "/portal/skype/call/login";
						// + location.pathname;
						var uiInitializer = skype.uiApplication(redirectUri);
						uiInitializer.done(function(api, uiApp) {
							// render the call CC
							log(">>>> MSSFB app created OK, user: " + uiApp.personsAndGroupsManager.mePerson.displayName());
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
								var $convo = $("#mssfb-call-conversation");
								if ($convo.length == 0) {
									$convo = $("<div id='mssfb-call-conversation'></div>");
									addToContainer($convo);
								}
								log(">>>> MSSFB conversation is creating in " + $convo.get(0) + " participants: "
											+ participants.join(","));
								api.renderConversation($convo.get(0), {
									"modalities" : [ "Chat" ], // , "Video"
									"participants" : participants
								}).then(function(conversation) {
									// Conversation Control was rendered successfully
									log(">>>> MSSFB conversation rendered successfully: " + JSON.stringify(conversation));
									// Add additional listeners for changes to conversation state here (see below section)
									// conversation.chatService.start().then(function() {
									// // chatService started successfully
									// log("Skype chatService started successfully");
									// }, function(err) {
									// log("Skype error starting chatService " + err);
									// });
									// conversation.topic("TODO")
									conversation.videoService.start().then(function(obj) {
										// videoService started successfully
										log(">>>>> MSSFB video started: " + JSON.stringify(obj));
									}, function(error) {
										// error starting chatService, cancel (by this user) also will go here
										log("<<<<< Error starting MSSFB video: " + JSON.stringify(error));
										if (error) {
											if (error.reason && error.reason.subcode && error.reason.message) {
												showError(error.reason.subcode, error.reason.message);
											} else {
												if (error.code && error.code == "Canceled") {
													// Do nothing
												} else {
													showError("Error starting video call", error);
												}
											}
										}
									});
									window.addEventListener("beforeunload", function(e) {
										var msg = onClosePage(conversation, uiApp);
										e.returnValue = msg; // Gecko, Trident, Chrome 34+
										return msg; // Gecko, WebKit, Chrome <34
									});
									window.addEventListener("unload", function(e) {
										onClosePage(conversation, uiApp);
									});
								}, function(err) {
									// error rendering Conversation Control
									if (err.name && err.message) {
										log(">>>> MSSFB conversation rendering error: " + err.name + " " + err.message, err);
										showError(err.name, err.message);
									} else {
										log(">>>> MSSFB conversation rendering error: " + JSON.stringify(err));
									}
								});
								// });
							} catch (err) {
								log(">>>> MSSFB call error:", err);
								showError("Call Error", err);
							}
						});
						uiInitializer.fail(function(err) {
							// TODO we have an error, check if it's auth problem, then force to login
							log(">>>> MSSFB app error: " + err);
							showError("Appplication Error", err);
						});
					}
					if (hasError) {
						log(">>>> MSSFB call error: " + location.hash);
						handleError();
					}
					log("<<< MSSFB call");
				} else {
					log(">>> MSSFB default page " + location.href);
					var hasIdToken = /#id_token=/.test(location.hash);
					if (hasIdToken && location.hash.indexOf("admin_consent=True") >= 0) {
						log(">>>> MSSFB admin consent: " + location.hash);
						var $root = $("#mssfb-call-root");
						if ($root.length == 0) {
							$root = $("<div id='mssfb-call-root'></div>");
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
						log(">>>> MSSFB token: " + location.hash);
						var $root = $("#mssfb-call-root");
						if ($root.length == 0) {
							$root = $("<div id='mssfb-call-root'></div>");
							addToContainer($root);
						}
						$root.text("Skype Calls default page. Please go to Portal Home and start a call from there.");
						addToContainer($("<div><a href='/portal'>Home</a></div>"));
					}
					if (hasError) {
						log(">>>> MSSFB error: " + location.hash);
						handleError();
					}
					log("<<< MSSFB default page");
				}
			});
		} else {
			console.log("MSSFB provider not found for mssfb-call.js");
		}
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for mssfb-call.js");
}
