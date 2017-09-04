/**
 * WebRTC call application (web page). This script initializes an UI of a page that will handle a particular call.
 */
if (eXo.videoCalls) {
	(function(videoCalls) {
		"use strict";
		
		/** For debug logging. */
		var objId = Math.floor((Math.random() * 1000) + 1);
		var logPrefix = "[webrtccall_" + objId + "] ";
		var log = function(msg, e) {
			if (typeof console != "undefined" && typeof console.log != "undefined") {
				if (e) {
					console.log(logPrefix + msg + (typeof e == "string" ? (". Error: " + e) : JSON.stringify(e)));
					if (typeof e.stack != "undefined") {
						console.log(e.stack);
					}
				} else {
					console.log(logPrefix + msg);
				}
			}
		};
		// log("> Loading at " + location.origin + location.pathname);
		
		var isP2PCall = /\/p\//.test(location.pathname); // incoming p2p call
		var isGroupCall = /\/g\//.test(location.pathname); // incoming group call
		//var isHost = /\?host/.test(location.search); // create new call

		function alignLoader() {
			var $throber = $("#webrtc-call-starting>.waitThrobber");
			if ($throber.length > 0) {
				var newHeight = $(window).height() - 30; // 15px for margins top/bottom
				var oldHeight = $throber.height();
				if (newHeight > 0) {
					$throber.height(newHeight);
				}
			}
		}
		
		function addToContainer($content) {
			var $container = $("div.webrtc-call-container");
			if ($container.length == 0) {
				$container = $("<div class='webrtc-call-container' style='display: none;'></div>");
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

		function showError(title, message) {
			$("#webrtc-call-conversation, #webrtc-call-starting").hide();
			var $error = $("#webrtc-call-error");
			if ($error.length == 0) {
				$error = $("<div id='webrtc-call-error'></div>");
				addToContainer($error);
			}
//			var $title = $error.find(".error-title");
//			if ($title.length == 0) {
//				$title = $("<h1 class='error-title'></h1>");
//				$error.append($title);
//			}
//			$title.text(title);
//			var $description = $error.find(".error-description");
//			if ($description.length == 0) {
//				$description = $("<div class='error-description'></div>");
//				$error.append($description);
//			}
//			$description.text(message);

			// Append errors (for history)
			var $title = $("<h1 class='error-title'></h1>");
			$title.text(title);
			$error.append($title);
			var $description = $("<div class='error-description'></div>");
			$description.text(message);
			$error.append($description);
		}
		
		function showStarted(message) {
			var $starting = $("#webrtc-call-starting");
			$starting.empty();
			var $info = $(".startInfo");
			if ($info.length == 0) {
				$info = $("<div class='startInfo'></div>");
				$starting.append($info);
			}
			$info.text(message);
		}
		
		function objectUrl(obj) {
			if (window.URL) {
		  	return window.URL.createObjectURL(obj);
		  } else {
		  	return obj;
		  }
		}
		
		$(function() {
			alignLoader();
		});
		
		eXo.videoCalls.startCall = function(call, onStop/*, onError*/) {
			var process = $.Deferred();
			$(function() {
				var webrtc = videoCalls.getProvider("webrtc");
				if (webrtc) {
					log(">> WebRTC call: " + location.origin + location.pathname);
					var callId = call.id;
					var isGroup = callId.startsWith("g/");
					if (isGroup) {
						log(">> Group calls not supported by WebRTC");
						showError("Warning", "Group calls not supported by WebRTC provider");
						setTimeout(function() {
							window.close();
						}, 7000);
						process.reject("Group calls not supported by WebRTC");
					} else {
						log("Preparing call " + callId + " > " + new Date().getTime());
						var currentUserId = videoCalls.getUser().id;
						var clientId = webrtc.getClientId();
						var isOwner = currentUserId == call.owner.id;
						// Use this for avatar when no video stream available
						//var callerLink = call.ownerLink;
						//var callerAvatar = call.avatarLink;
						
						$("#webrtc-call-starting").hide();
						var $convo = $("#webrtc-call-conversation");
						if ($convo.length == 0) {
							$convo = $("<div id='webrtc-call-conversation'></div>");
							addToContainer($convo);
						}
						var $title = $("<div id='webrtc-call-title'><h1 class='call-title'>" + call.title + "</h1></div>");
						$convo.append($title);
						
						var $remoteVideo = $("<video id='video-remote' autoplay></video>");
						$convo.append($remoteVideo);
						var $localVideo = $("<video id='video-local' width='160' height='120' autoplay></video>");
						$convo.append($localVideo);
						var $controls = $("<div></div>");
						// var $startButton = $("<button id='start-button'>Start</button>");
						// var $callButton = $("<button id='call-button'>Call</button>");
						var $hangupButton = $("<button id='hangup-button'>Hang Up</button>");
						$controls.append($hangupButton);
						$convo.append($controls);
						
						// WebRTC connection to establish a call connection
						var pc = new RTCPeerConnection(); // TODO servers
						var negotiation = $.Deferred();
						var connection = $.Deferred();
						var handleError = function(title, message) {
							showError(title, message);
							if (!(pc.signalingState == "closed" || pc.connectionState == "closed")) {
								try {
									//pc.close();
								} catch(e) {
									log("WARN Failed to close peer connection: ", e);
								}								
							}
						}
						connection.fail(function(err) {
							log("ERROR starting connection for " + callId + ": " + JSON.stringify(err));
							handleError("Error of starting connection", err);
						});
						var sendMessage = function(message) {
							return videoCalls.toCallUpdate(callId, $.extend({
				    		"provider" : webrtc.getType(),
				    		"sender" : currentUserId,
				    		"client" : clientId,
				    		"host" : isOwner
				      }, message)).done(function(status) {
				      	log("<< " + status + " data: " + JSON.stringify(message));
				      });
						};
						var helloCounter = 0;
						var sendHello = function() {
							// It is a first message send on the call channel by a peer, 
							// it tells that the end is ready to exchange other information (i.e. accepted the call)
							// If it will be required to change a host in future, then this message should be send
							// by a new host with '__all__' content, others should understand this and update their 
							// owner ID to this sender ID.
							return sendMessage({
				    		"hello": isOwner ? "__all__" : call.owner.id
				      }).done(function() {
				      	log("<< Published hello to " + callId);
							}).fail(function(err) {
								log("ERROR publishing hello to " + callId + ": " + JSON.stringify(err));
							}).always(function() {
								helloCounter++;
							});
						};
						var sendOffer = function(localDescription) {
							return sendMessage({
				    		"offer": JSON.stringify(localDescription)
				      }).done(function() {
				      	log("<< Published offer to " + callId);
							}).fail(function(err) {
								log("ERROR publishing offer to " + callId + ": " + JSON.stringify(err));
								// TODO May retry?
								handleError("Error of sharing media offer", err);
							});
						};
						var sendAnswer = function(localDescription) {
							return sendMessage({
				    		"answer": JSON.stringify(localDescription)
				      }).done(function() {
				      	log("<< Published answer to " + callId + " > " + new Date().getTime());
							}).fail(function(err) {
								log("ERROR publishing answer to " + callId + ": " + JSON.stringify(err));
								handleError("Error of sharing media answer", err);
							});
						};
						var sendCandidate = function(candidate) {
							return sendMessage({
				    		// "sdpMLineIndex" : event.candidate.sdpMLineIndex,
				        // "sdpMid": event.candidate.sdpMid,
				        "candidate" : candidate
				      }).done(function() {
				      	log("<< Published candidate to " + callId);
							}).fail(function(err) {
								log("ERROR publishing candidate to " + callId + ": " + JSON.stringify(err));
								handleError("Error of sharing connection", err);
							});
						};
						
						// 'Hang Up' and page close actions to end call properly
						var stopping = false;
						var stopCall = function() {
							// TODO here we also could send 'bye' message - it will work for 'Hang Up' button, 
							// but in case of page close it may not be sent to others, thus we call the callback onStop
							// to let the caller page handle the call end in its own way.
							if (!stopping) {
								stopping = true;
								function stopLocal() {
									try {
										pc.close();
									} catch(e) {
										log("WARN Failed to close peer connection: ", e);
									}
									window.removeEventListener("beforeunload", beforeunloadListener);
									window.removeEventListener("unload", unloadListener);
								}
								if (typeof onStop == "function") {
									onStop().done(function() {
										stopLocal();
									}).fail(function(err) {
										log("ERROR Call failed to stop properly");
									});
								} else {
									stopLocal();
								}
							}
						};
						var beforeunloadListener = function(e) {
							stopCall();
						};
						var unloadListener = function(e) {
							stopCall();
						};
						window.addEventListener("beforeunload", beforeunloadListener);
						window.addEventListener("unload", unloadListener);
						var stopCallWaitClose = function() {
							stopCall();
							setTimeout(function() {
								window.close();
							}, 3500);
						};
						$hangupButton.click(function() {
							stopCallWaitClose();
						});
						
						// Add peer listeners for connection flow
						pc.onicecandidate = function (event) {
							// This will happen when browser will be ready to exchange peers setup
							log(">>> onIceCandidate for " + callId + ": " + JSON.stringify(event) + " > " + new Date().toLocaleString());
					    if (event.candidate) {
					    	connection.then(function() {
					    		sendCandidate(event.candidate);
					    	});
					    } else {
					      // else All ICE candidates have been sent. ICE gathering has finished.
					    	// TODO any action is expected here?
					    	log("<<< All ICE candidates have been sent");
					    }
					  };
				  	// let the 'negotiationneeded' event trigger offer generation
					  pc.onnegotiationneeded = function () {
					  	// This will be fired after adding a local media stream and browser readiness
					  	log(">>> onNegotiationNeeded for " + callId + " > " + new Date().toLocaleString());
					  	// Ready to join the call: say hello to each other
			  			if (isOwner) {
			  				sendHello().then(function() {
				  				log(">>>> Sent Hello by " + (isOwner ? "owner" : "participant") + " to " + callId + " > " + new Date().toLocaleString());
				  			});
					  		// Owner will send the offer when negotiation will be resolved (received Hello from others)
			  				negotiation.then(function() {
							    pc.createOffer().then(function(desc) {
							    	log(">>>> createOffer for " + callId + " > " + new Date().toLocaleString());
							    	pc.setLocalDescription(desc).then(function() {
							    		log(">>>>> setLocalDescription for " + callId + " > " + new Date().toLocaleString());
							    		sendOffer(pc.localDescription).then(function() {
								    		connection.resolve().then(function() {
									      	// Owner ready to exchange ICE candidates
													log("<<<<< Starting exchange network information with peers of " + callId + " > " + new Date().toLocaleString());
												});
							    		});
							      }).catch(function(err) {
							      	log(">>> Error settings local offer for " + callId);
							      	handleError("Error of preparing connection", err);
								    });
							    }).catch(function(err) {
							    	log(">>> Error creating offer for " + callId);
							    	handleError("Error of starting connection", err);
							    });
			  				});
					  	}
					  };			  	
					  // once remote stream arrives, show it in the remote video element
					  /*pc.ontrack = function(event) {
					  	log(">>> onTrack for " + callId + " > " + new Date().toLocaleString());
					  	$remoteVideo.get(0).srcObject = event.streams[0];
					  };*/
						pc.onaddstream = function (event) { 
							log(">>> onAddStream for " + callId + " > " + new  Date().getTime()); 
							//$remoteVideo.attr("src", objectUrl(event.stream));
							var video = $remoteVideo.get(0);
							video.srcObject = event.stream;
							video.onloadedmetadata = function(event1) {
								video.play();
							};
						};
					  pc.onremovestream = function(event) {
					  	// TODO check the event stream URL before removal?
					  	log(">>> onRemoveStream for " + callId + " > " + new Date().toLocaleString());
					  	$remoteVideo.removeAttr("src");
					  };
						
						// Subscribe to the call updates
						var listener = videoCalls.onCallUpdate(callId, function(message) {
							// TODO handle the remote side data
							if (message.provider == webrtc.getType()) {
								if (message.sender != currentUserId) {
									log(">>> Received call update for " + callId + ": " + JSON.stringify(message) + " > " + new Date().toLocaleString());
									if (message.candidate) {
										// ICE candidate of remote party (can happen several times)
										log(">>> Received candidate for " + callId);
										connection.then(function() {
											log(">>>> Apply candidate for " + callId);
											pc.addIceCandidate(new RTCIceCandidate(message.candidate)).then(function() {
									      log(">>>>> Apllied candidate for " + callId + " > " + new Date().toLocaleString());
									    }).catch(function(err) {
									    	log("ERROR adding candidate for " + callId + ": " + JSON.stringify(err));
									    	handleError("Error establishing call", err);
									    });											
										});
									} else if (message.offer) {
										log(">>> Received offer for " + callId);
										// Offer of a caller on callee side
										if (isOwner) {
											log("<<< Unexpected offer received on owner side of " + callId);
										} else {
											try {
												var offer = JSON.parse(message.offer);
												// was: new RTCSessionDescription(offer)
												negotiation.then(function(localStream) {
													pc.setRemoteDescription(offer).then(function() {
														log(">>>> Apllied offer for " + callId + " > " + new Date().toLocaleString());
											      // if we received an offer, we need to answer
											      if (pc.remoteDescription.type == "offer") {
											      	// Add local stream for participant after media negotiation (as in samples) 
											      	pc.addStream(localStream); // XXX It's deprecated way but Chrome works using it
											      	// Will it be better to do this in onnegotiationneeded event?
											      	pc.createAnswer().then(function(desc) {
											      		pc.setLocalDescription(desc).then(function() {
											      			sendAnswer(pc.localDescription).then(function() {
											      				connection.resolve().then(function() {
											      					// Participant ready to exchange ICE candidates
																			log("<<<< Starting exchange network information with peers of " + callId + " > " + new Date().toLocaleString());
																		});
											      			});
											      		}).catch(function(err) {
											      			log("ERROR setting local answer for " + callId + ": " + JSON.stringify(err));
												      		handleError("Error accepting call", err);
											      		});
											      	}).catch(function(err) {
											      		log("ERROR answering offer for " + callId + ": " + JSON.stringify(err));
											      		handleError("Error answering call", err);
											      	});
											      }
											    }).catch(function(err) {
											    	log("ERROR setting remote offer for " + callId + ": " + JSON.stringify(err));
											    	handleError("Error applying call", err);
											    });
												});
											} catch(e) {
												log("Error applying offer: " + message.offer, e);
											}
										}
									} else if (message.answer) {
										if (isOwner) {
											// Answer of a callee to the caller: it's final stage of the parties discovery
											log(">>> Received answer for " + callId);
											try {
												var answer = JSON.parse(message.answer);
												negotiation.then(function() {
													pc.setRemoteDescription(answer).then(function() {
											      log(">>>> Apllied answer for " + callId + " > " + new Date().toLocaleString());
											      // TODO anything else here?
											    }).catch(function(err) {
											    	log("ERROR setting remote answer for " + callId + ": " + JSON.stringify(err));
											    	handleError("Error answering call", err);
											    });
												});
											} catch(e) {
												log("Error applying answer: " + message.answer, e);
											}
										} else {
											// FYI this could be OK to receive for group call
											log("<<< Unexpected answer received on participant side of " + callId);
										}
									} else if (message.hello) {
										// To start the call send "hello" - first message in the flow for each client
										log(">>> Received Hello for " + callId + ": " + JSON.stringify(message.hello) + " > " + new Date().toLocaleString());
										if (message.hello == currentUserId) {
											// We assume it's a hello to the call owner: start sending offer and candidates
											// This will works once (for group calls, need re-initialize the process)
											negotiation.resolve().then(function() {
												log("<<< Starting exchange media information of " + callId + " > " + new Date().toLocaleString());
											});
										} else {
											log("<<< Hello was not to me (" + currentUserId + ")");
										}
									} else if (message.bye) {
										// TODO not used
										// Remote part leaved the call: stop listen the call
										log(">>> Received bye for " + callId + ": " + JSON.stringify(message.bye) + " > " + new Date().toLocaleString());
										listener.off();
										// TODO Tell local user, close the window?
									} else {
										log("<<< Received unexpected message for " + callId);
									}
								} else {
									//log("<<< skip own update");
								}
							}
						}, function(err) {
							log("ERROR subscribe to " + callId + ": " + JSON.stringify(err));
							process.reject("Error setting up connection (subscribe call updates): " + err);
							handleError("Connection error", err.message);
						});
						
						// Show current user camera in the video,
						// TODO if camera not found then show something for audio presence
						
						// When using shim adapter.js don't need do the selection like below
						// var userMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
						var constraints = {
						  audio: true,
						  video: true
						};
						// TODO handle cases when video/audio not available
						navigator.mediaDevices.getUserMedia(constraints).then(function(localStream) {
							// successCallback
							// show local camera output
							// $localVideo.attr("src", objectUrl(localStream));
							var localVideo = $localVideo.get(0);
							localVideo.srcObject = localStream;
							localVideo.onloadedmetadata = function(event) {
								localVideo.play();
							};
						  log("Starting call " + callId + " > " + new Date().toLocaleString());
						  // add local stream for owner right now
						  if (isOwner) {
							  pc.addStream(localStream); // XXX It's deprecated way but Chrome works using it
							  //localStream.getTracks().forEach(function(track) {
							  //  pc.addTrack(track, localStream);
							  //});
						  } else {
						  	// Participant sends Hello to the other end to initiate a negotiation there
						  	sendHello().then(function() {
				  				log(">>>> Sent Hello by participant to " + callId + " > " + new Date().toLocaleString());
				  				// Participant on the other end is ready for negotiation and waits for an offer message
						  		negotiation.resolve(localStream).then(function() {
										log("<<<< Starting exchange media information of " + callId + " > " + new Date().toLocaleString());
									});
				  			});
						  }
						  
						  // Finally subscribe to user calls to know if this call updated/stopped remotely
						  videoCalls.onUserUpdate(currentUserId, function(update, status) {
								if (update.eventType == "call_state") {
									if (update.caller.type == "user") {
										var callId = update.callId;
										if (update.callState == "stopped" && update.callId == callId) {
											log(">>> Call stopped remotelly: " + JSON.stringify(update) + " [" + status + "]");
											stopCallWaitClose();
										}							
									}
								}
							}, function(err) {
								log("ERROR User calls subscription failure: " + err, err);
							});
						}).catch(function(err) {
							// errorCallback
							log(">> User media error: " + JSON.stringify(err));
							// process.reject("User media error: " + err);
							handleError("Media error", err);
						});
						process.resolve("Started");
					}
				} else {
					process.reject("WebRTC provider not found");
				}
			});
			return process.promise();
		};
		
		log("< Loaded at " + location.origin + location.pathname + " -- " + new Date().toLocaleString());
	})(eXo.videoCalls);
} else {
	console.log("eXo.videoCalls not defined for webrtc-call.js");
}
