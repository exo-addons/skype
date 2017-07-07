/**
 * Microsoft Skype for Business call application (web page). This script initializes an UI of a page that will handle a particular call.
 */
if (eXo.videoCalls) {
	(function(videoCalls) {
		"use strict";
		
		/** For debug logging. */
		var objId = Math.floor((Math.random() * 1000) + 1);
		var logPrefix = "[mssfbcall_" + objId + "] ";
		var log = function(msg, e) {
			if (typeof console != "undefined" && typeof console.log != "undefined") {
				console.log(logPrefix + msg);
				if (e && typeof e.stack != "undefined") {
					console.log(e.stack);
				}
			}
		};
		log("> Loading at " + location.origin + location.pathname);
		
		var mssfb = videoCalls.getProvider("mssfb");
		if (mssfb) {
			var hashLine = location.hash;
			var hasToken = /#access_token=/.test(hashLine);
			var hasError = /#error=/.test(hashLine);
			var isLogin = /\/login/.test(location.pathname);
			var isNewCall = /\/_\//.test(location.pathname); // need make an outgoing call
			var isP2PCall = /\/p\//.test(location.pathname); // incoming p2p call 
			var isGroupCall = /\/g\//.test(location.pathname); // incoming group call
			var isCall = isNewCall || isP2PCall || isGroupCall;
			var isClosed = false;

			function getParameterByName(name, url) {
				if (!url) {
					url = window.location.href;
				}
				name = name.replace(/[\[\]]/g, "\\$&");
				var regex = new RegExp("[?&#]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
				if (!results)
					return null;
				if (!results[2])
					return "";
				return decodeURIComponent(results[2].replace(/\+/g, " "));
			}

			function alignLoader() {
				var $throber = $("#mssfb-call-starting>.waitThrobber");
				if ($throber.length > 0) {
					var newHeight = $(window).height() - 30; // 15px for margins top/bottom
					var oldHeight = $throber.height();
					if (newHeight > 0) {
						$throber.height(newHeight);
					}
				}
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
				$("#mssfb-call-conversation, #mssfb-call-starting").hide();
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
			
			function showStarted(message) {
				var $starting = $("#mssfb-call-starting");
				$starting.empty();
				var $info = $(".startInfo");
				if ($info.length == 0) {
					$info = $("<div class='startInfo'></div>");
					$starting.append($info);
				}
				$info.text(message);
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
					// TODO what a right approach to leave the convo? 
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
			
			if (isLogin) {
				// FYI it's what WebSDK calls an "empty page"
				log(">> MSSFB login: " + mssfb.tokenHashInfo(hashLine));
				$(function() {
					alignLoader();
				});
				var parent = window.opener ? window.opener : (window.parent ? window.parent : null);
				if (hasToken) {
					// FYI we assume expiration time in seconds
					var expiresIn;
					try {
						expiresIn = parseInt(getParameterByName("expires_in", hashLine));
					} catch(e) {
						log("Error parsing token expiration time: " + e);
						expiresIn = 0;
					}
					var token = {
						"access_token" : getParameterByName("access_token", hashLine),
						"token_type" : getParameterByName("token_type", hashLine),
						"session_state" : getParameterByName("session_state", hashLine),
						"hash_line" : hashLine,
						"expires_in" : expiresIn,
						"created" : Math.floor(new Date().getTime()/1000)
					};
					// FYI window.opener.eXo.videoCalls.mssfb.loginToken will exist only within provider.init() execution and short time
					// thus this if-block should not execute for call authentication
					if (parent && parent.eXo && parent.eXo.videoCalls && parent.eXo.videoCalls.mssfb) {
						//var parentUri = parent.location.href;
						//log(">>>> MSSFB login opener: " + parentUri);
						// **** TODO experiments with ADSL to obtain auth token for SDK calls later
						/*var settings = {
									clientId : clientId,
									cacheLocation: "localStorage"
								};
						var msOnlineContext = new AuthenticationContext(settings);
						msOnlineContext.login();
						msOnlineContext.acquireToken("https://login.microsoftonline.com/common", function(res) {
		        	log("msOnlineContext.acquireTokenSilentAsync: " + JSON.stringify(res));
		        });
						var winGraphContext = new AuthenticationContext(settings);
						winGraphContext.acquireToken("https://graph.windows.net", function(res) {
		        	log("winGraphContext.acquireTokenSilentAsync: " + JSON.stringify(res));
		        });*/
						//
						
						if (parent.eXo.videoCalls.mssfb.loginToken) {
							log(">>> use parent.eXo.videoCalls.mssfb.loginToken()");
							parent.eXo.videoCalls.mssfb.loginToken(token).always(function() {
								showStarted("Successfully authorized in " + mssfb.getTitle() + " account."); // TODO is it correct sentense?
								setTimeout(function() {
									window.close();
								}, 2500);
							});	
						} else {
							//log(">>> use parent.eXo.videoCalls.mssfb.saveToken()");
							//parent.eXo.videoCalls.mssfb.saveToken(token);
						}
					} else {
						log(">>> login has no opener or not initialized for callback token");
						// , use mssfb.saveToken()
						//mssfb.saveToken(token);
					}
				}
				if (hasError) {
					log("MSSFB login error: " + location.hash);
					handleError();
				}
				log("<< MSSFB login");
			} else {
				$(function() {
					alignLoader();
					var clientId = mssfb.getClientId();
					
					/* TODO not used */
					window.notifyUser = function(message) {
						if (typeof(message) == "object") {
							videoCalls.showWarn(message.title, message.text);
						} else {
							videoCalls.showWarn("Warning", message);
						}
					};
					
					if (isCall) {
						log(">> MSSFB call: " + location.origin + location.pathname);
						var pageCallId;
						var ciIndex = location.pathname.indexOf("call/") + 5;
						if (ciIndex > 5 && location.pathname.length > ciIndex) {
							pageCallId = decodeURIComponent(location.pathname.substring(ciIndex));
						} else {
							pageCallId = "???" + location.pathname;
						}
						// TODO care if multiple convos were running in this page (others started directly from CC UI)
						var currentConversation;
						// it's call window, user may be already authenticated, but may be not
						if (hasToken) {
							var redirectUri = videoCalls.getBaseUrl() + "/portal/skype/call/login";
							var uiInitializer = mssfb.uiApplication(redirectUri);
							uiInitializer.done(function(api, uiApp) {
								// render the call CC
								log(">>> MSSFB app created OK, user: " + uiApp.personsAndGroupsManager.mePerson.displayName());
								try {
									$("#mssfb-call-starting").hide();
									var $convo = $("#mssfb-call-conversation");
									if ($convo.length == 0) {
										$convo = $("<div id='mssfb-call-conversation'></div>");
										addToContainer($convo);
									}
									log(">>> MSSFB conversation is creating in " + $convo.get(0) + " " + pageCallId);
									
									var beforeunloadListener = function(e) {
										if (currentConversation) {
											var msg = onClosePage(currentConversation, uiApp);
											e.returnValue = msg; // Gecko, Trident, Chrome 34+
											return msg; // Gecko, WebKit, Chrome <34
										}
									};
									var unloadListener = function(e) {
										if (currentConversation) {
											onClosePage(currentConversation, uiApp);
										}
									};
									var handleError = function(error) {
										if (error) {
											if (error.reason && error.reason.subcode && error.reason.message) {
												showError(error.reason.subcode, error.reason.message);
											} else {
												if (error.code && error.code == "Canceled") {
													// Do nothing
												} else {
													showError("Error starting the call", error);
												}
											}
										}
										window.removeEventListener("beforeunload", beforeunloadListener);
										window.removeEventListener("unload", unloadListener);
									};
									
									if (isP2PCall || isGroupCall) {
										// it's incoming call
										log(">>> Incoming calls not supported on this page: " + pageCallId);
									} else {
										// it's a new outgoing call
										var outgoingConversation = function(options) {
											options.modalities = [ "Chat" ]; // , "Video"
											api.renderConversation($convo.get(0), options).then(function(conversation) {
												currentConversation = conversation;
												mssfb.logConversation(conversation);
												if (mssfbCallTitle) {
													conversation.topic(mssfbCallTitle);
												}
												// TODO in case of video error, but audio or chat success - show a hint message to an user and auto-hide it
												var callId = mssfb.getCallId(conversation);
												var registerCall = function() {
													var ownerId, ownerType;
													if (conversation.isGroupConversation()) {
														var spaceId = videoCalls.getCurrentSpaceId();
														if (spaceId != null) {
															ownerId = spaceId;
															ownerType = "space";
														} else {
															var roomTitle = videoCalls.getCurrentRoomTitle();
															if (roomTitle != null) {
																ownerId = roomTitle;
																ownerType = "chat_room";
															}
														}
														// we assume it's custom Chat room
													} else {
														ownerId = videoCalls.getUser().id;
														ownerType = "user";
													}
													// call creator goes first in the ID of p2p
													var participants = [];
													for (var i=0; i<conversation.participantsCount(); i++) {
														var pid = conversation.participants(i).person.id();
														participants.push(pid);
													}
													var callInfo = {
														owner : ownerId,
														ownerType : ownerType,  
														provider : mssfb.getType(),
														title : conversation.topic(),
														participants : participants.join("+")
													};
													videoCalls.registerCall(callId, callInfo).done(function(call) {
														log(">>>> MSSFB call " + callId + " registered");
													}).fail(function(err) {
														log(">>>> MSSFB call " + callId + " registration failed " + JSON.stringify(err));
													});
												};
												var unregisterCall = function() {
													videoCalls.unregisterCall(callId).done(function(call) {
														log("<<<< MSSFB call " + callId + " unregistered");
													}).fail(function(err) {
														log("<<<< MSSFB call " + callId + " unregistration failed " + JSON.stringify(err));
													});
												};
												registerCall();
												conversation.videoService.start().then(function() {
													log(">>>> MSSFB video STARTED");
												}, function(videoError) {
													// error starting videoService, cancel (by this user) also will go here
													log("<<<< Error starting MSSFB video: " + JSON.stringify(videoError));
													var finisWithError = function(error) {
														unregisterCall();
														handleError(error);
													};
													if (mssfb.isModalityUnsupported(videoError)) {
														// ok, try audio
														conversation.audioService.start().then(function() {
															log(">>>> MSSFB audio STARTED");
														}, function(audioError) {
															log("<<<< Error starting MSSFB audio: " + JSON.stringify(audioError));
															if (mssfb.isModalityUnsupported(audioError)) {
																// well, it will be chat (it should work everywhere)
																conversation.chatService.start().then(function() {
																	log(">>>> MSSFB chat STARTED");
																}, function(chatError) {
																	log("<<<< Error starting MSSFB chat: " + JSON.stringify(chatError));
																	// we show original error
																	finisWithError(videoError);
																});
															} else {
																finisWithError(videoError);
															}
														});
													} else {
														finisWithError(videoError);
													}
												});
												window.addEventListener("beforeunload", beforeunloadListener);
												window.addEventListener("unload", unloadListener);
											}, function(err) {
												// error rendering Conversation Control
												if (err.name && err.message) {
													log(">>> MSSFB conversation rendering error: " + err.name + " " + err.message, err);
													showError(err.name, err.message);
												} else {
													log(">>> MSSFB conversation rendering error: " + JSON.stringify(err));
												}
											});
										};
										// TODO for group calls use its URI stored in space/room
										var participants = pageCallId.substring(2).split("+");
										var options = {
											participants : participants
										};
										outgoingConversation(options);
									}
								} catch (err) {
									log(">>> MSSFB call error:", err);
									showError("Call Error", err);
								}
							});
							uiInitializer.fail(function(err) {
								// TODO we have an error, check if it's auth problem, then force to login
								log(">>> MSSFB app error: " + err);
								showError("Application Error", err);
							});
						}
						if (hasError) {
							log("<<< MSSFB call error: " + location.hash); // show fill hash, it contains an error
							handleError();
						}
						log("<< MSSFB call");
					} else {
						log(">> MSSFB default page " + location.origin + location.pathname);
						var hasIdToken = /#id_token=/.test(hashLine);
						if (hasIdToken && location.hash.indexOf("admin_consent=True") >= 0) {
							log(">>> MSSFB admin consent: " + mssfb.tokenHashInfo(hashLine));
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
							log(">>> MSSFB token: " + mssfb.tokenHashInfo(hashLine));
							var $root = $("#mssfb-call-root");
							if ($root.length == 0) {
								$root = $("<div id='mssfb-call-root'></div>");
								addToContainer($root);
							}
							$root.text("Skype Calls default page. Please go to Portal Home and start a call from there.");
							addToContainer($("<div><a href='/portal'>Home</a></div>"));
						}
						if (hasError) {
							log("<<< MSSFB error: " + location.hash);
							handleError();
						}
						log("<< MSSFB default page");
					}
				});
			}
		} else {
			console.log("MSSFB provider not found for mssfb-call.js");
		}
		log("< Loaded at " + location.origin + location.pathname);
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for mssfb-call.js");
}
