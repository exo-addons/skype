/*
 * Copyright (C) 2003-2017 eXo Platform SAS.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */
package org.exoplatform.videocalls.cometd;

import static org.exoplatform.videocalls.VideoCallsUtils.asJSON;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import javax.inject.Inject;

import org.cometd.annotation.Configure;
import org.cometd.annotation.Param;
import org.cometd.annotation.RemoteCall;
import org.cometd.annotation.ServerAnnotationProcessor;
import org.cometd.annotation.Service;
import org.cometd.annotation.Session;
import org.cometd.annotation.Subscription;
import org.cometd.bayeux.Message;
import org.cometd.bayeux.server.BayeuxServer;
import org.cometd.bayeux.server.BayeuxServer.ChannelListener;
import org.cometd.bayeux.server.ConfigurableServerChannel;
import org.cometd.bayeux.server.LocalSession;
import org.cometd.bayeux.server.ServerChannel;
import org.cometd.bayeux.server.ServerChannel.SubscriptionListener;
import org.cometd.bayeux.server.ServerMessage;
import org.cometd.bayeux.server.ServerSession;
import org.cometd.bayeux.server.ServerSession.RemoveListener;
import org.eclipse.jetty.util.component.LifeCycle;
import org.exoplatform.container.ExoContainer;
import org.exoplatform.container.ExoContainerContext;
import org.exoplatform.services.jcr.ext.app.SessionProviderService;
import org.exoplatform.services.jcr.ext.common.SessionProvider;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.services.organization.OrganizationService;
import org.exoplatform.services.security.ConversationState;
import org.exoplatform.services.security.Identity;
import org.exoplatform.services.security.IdentityConstants;
import org.exoplatform.services.security.IdentityRegistry;
import org.exoplatform.videocalls.CallInfo;
import org.exoplatform.videocalls.CallInfoException;
import org.exoplatform.videocalls.CallState;
import org.exoplatform.videocalls.IdentityInfo;
import org.exoplatform.videocalls.UserCallListener;
import org.exoplatform.videocalls.UserState;
import org.exoplatform.videocalls.VideoCallsService;
import org.exoplatform.videocalls.client.ErrorInfo;
import org.exoplatform.ws.frameworks.json.impl.JsonException;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.mortbay.cometd.continuation.EXoContinuationBayeux;
import org.picocontainer.Startable;

/**
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: CometdVideoCallsService.java 00000 Aug 17, 2017 pnedonosko $
 * 
 */
public class CometdVideoCallsService implements Startable {

  public static final String             CALLS_CHANNEL_NAME                = "/videocalls/calls";

  public static final String             CALLS_SERVICE_CHANNEL_NAME        = "/service" + CALLS_CHANNEL_NAME;

  public static final String             USERS_SERVICE_CHANNEL_NAME        = "/service/videocalls/users";

  public static final String             CALL_SUBSCRIPTION_CHANNEL_NAME    =
                                                                        "/eXo/Application/VideoCalls/call/{callId}";

  public static final String             USER_SUBSCRIPTION_CHANNEL_NAME    =
                                                                        "/eXo/Application/VideoCalls/user";

  public static final String             USER_SUBSCRIPTION_CHANNEL_PATTERN = USER_SUBSCRIPTION_CHANNEL_NAME
      + "/{userId}";

  public static final String             COMMAND_GET                       = "get";

  public static final String             COMMAND_CREATE                    = "create";

  public static final String             COMMAND_UPDATE                    = "update";

  public static final String             COMMAND_DELETE                    = "delete";

  public static final String             COMMAND_GET_CALLS_STATE           = "get_calls_state";

  private static final Log               LOG                               =
                                             ExoLogger.getLogger(CometdVideoCallsService.class);

  protected final VideoCallsService      videoCalls;

  protected final EXoContinuationBayeux  exoBayeux;

  protected final CallService            service;

  protected final OrganizationService    organization;

  protected final SessionProviderService sessionProviders;

  protected final IdentityRegistry       identityRegistry;

  @Service("videocalls")
  public class CallService {

    class SessionRemoveListener implements RemoveListener {
      @Override
      public void removed(ServerSession session, boolean timeout) {
        if (LOG.isDebugEnabled()) {
          LOG.debug("Session removed: " + session.getId() + " timedout:" + timeout + " channels: "
              + channelsAsString(session.getSubscriptions()));
        }
        // cleanup session stuff, note that disconnected session already unsubscribed and has not channels
        channelClients.values().remove(session.getId());
        UserCallListener listener = clientUserListeners.remove(session.getId());
        if (listener != null) {
          videoCalls.removeUserCallListener(listener);
        }
      }
    }

    class ChannelSubscriptionListener implements SubscriptionListener {
      @Override
      public void subscribed(ServerSession remote, ServerChannel channel, ServerMessage message) {
        // FYI message will be null for server-side subscription
        String clientId = remote.getId();
        String channelId = channel.getId();
        String currentUserId = currentUserId(message);
        if (LOG.isDebugEnabled()) {
          LOG.debug("Subscribed: " + currentUserId + ", client:" + clientId + ", channel:" + channelId);
        }
        if (channelId.startsWith(USER_SUBSCRIPTION_CHANNEL_NAME)) {
          try {
            if (currentUserId != null) {
              String userId = channelUserId(channelId);
              if (currentUserId.equals(userId)) {
                // Tracking channel-to-clients mapping looks redundant, at first thought client-to-listener is
                // enough, but we keep channel's clients also for understanding consistency during development
                // and debug
                Set<String> clients = channelClients.computeIfAbsent(channelId,
                                                                     k -> ConcurrentHashMap.newKeySet());
                if (clients.contains(clientId) && clientUserListeners.containsKey(clientId)) {
                  LOG.warn("Subscription is already active for " + currentUserId + ", client: " + clientId
                      + ", channel: " + channelId);
                  remote.deliver(serverSession,
                                 channelId,
                                 ErrorInfo.clientError("Subscription already active").asJSON());
                } else {
                  UserCallListener listener = new UserCallListener(userId) {
                    @Override
                    public void onPartLeaved(String callId, String partId) {
                      StringBuilder data = new StringBuilder();
                      data.append('{');
                      data.append("\"eventType\": \"call_leaved\",");
                      data.append("\"callId\": \"");
                      data.append(callId);
                      data.append("\",\"part\": {");
                      data.append("\"id\": \"");
                      data.append(partId);
                      data.append("\"}");
                      data.append('}');
                      bayeux.getChannel(channelId).publish(serverSession, data.toString());
                    }

                    @Override
                    public void onPartJoined(String callId, String partId) {
                      StringBuilder data = new StringBuilder();
                      data.append('{');
                      data.append("\"eventType\": \"call_joined\",");
                      data.append("\"callId\": \"");
                      data.append(callId);
                      data.append("\",\"part\": {");
                      data.append("\"id\": \"");
                      data.append(partId);
                      data.append("\"}");
                      data.append('}');
                      bayeux.getChannel(channelId).publish(serverSession, data.toString());
                    }

                    @Override
                    public void onCallState(String callId,
                                            String callState,
                                            String callerId,
                                            String callerType) {
                      StringBuilder data = new StringBuilder();
                      data.append('{');
                      data.append("\"eventType\": \"call_state\",");
                      data.append("\"callId\": \"");
                      data.append(callId);
                      data.append('\"');
                      data.append(",\"callState\": \"");
                      data.append(callState);
                      data.append("\",\"caller\": {");
                      data.append("\"id\": \"");
                      data.append(callerId);
                      data.append("\",\"type\": \"");
                      data.append(callerType);
                      data.append("\"}");
                      data.append('}');
                      bayeux.getChannel(channelId).publish(serverSession, data.toString());
                    }

                    @Override
                    public boolean isListening() {
                      // TODO change the flag ASAP when will know about unsubscribing or session disconnected
                      return true;
                    }
                  };
                  videoCalls.addUserCallListener(listener);
                  clients.add(clientId);
                  clientUserListeners.put(clientId, listener);
                  // add listener for removed session cleanup
                  remote.addListener(sessionRemoveListener);
                  if (LOG.isDebugEnabled()) {
                    LOG.debug("Added user call listener for " + userId + ", client:" + clientId + ", channel:"
                        + channelId);
                  }
                }
              } else {
                LOG.warn("Subscribing to other user not possible, was user " + currentUserId + ", channel:"
                    + channelId);
                remote.deliver(serverSession,
                               channelId,
                               ErrorInfo.clientError("Subscribing to other user not possible").asJSON());
                if (!channel.unsubscribe(remote)) {
                  LOG.warn("Unable to unsubscribe user " + currentUserId + " from channel " + channelId);
                }
              }
            } else {
              LOG.warn("Subscribing by unauthorized user not possible, was channel: " + channelId);
              remote.deliver(serverSession, channelId, ErrorInfo.accessError("Unauthorized user").asJSON());
              if (!channel.unsubscribe(remote)) {
                LOG.warn("Unable to unsubscribe unauthorized user from channel " + channelId);
              }
            }
          } catch (IndexOutOfBoundsException e) {
            // Ignore channel w/o a subpath (userId here) at the end
            if (LOG.isDebugEnabled()) {
              LOG.debug("Ignore user channel w/o user ID at the end: " + channelId, e);
            }
          }
        }
      }

      @Override
      public void unsubscribed(ServerSession session, ServerChannel channel, ServerMessage message) {
        // FYI message will be null for server-side unsubscription
        String clientId = session.getId();
        String channelId = channel.getId();
        if (LOG.isDebugEnabled()) {
          LOG.debug("Unsubscribed client:" + clientId + ", channel:" + channelId);
        }
        // cleanup session stuff, note that disconnected session already unsubscribed and has not channels
        boolean hasClient = channelClients.getOrDefault(channelId, Collections.emptySet()).remove(clientId);
        if (hasClient) {
          UserCallListener listener = clientUserListeners.remove(clientId);
          if (listener != null) {
            videoCalls.removeUserCallListener(listener);
            if (LOG.isDebugEnabled()) {
              LOG.debug("Removed call listener for user " + listener.getUserId() + ", client:" + clientId
                  + ", channel:" + channelId);
            }
          } else {
            LOG.info("User call listener not found for client:" + clientId + ", channel:" + channelId);
          }
        }
        channelClients.values().remove(session.getId());
        UserCallListener listener = clientUserListeners.remove(session.getId());
        if (listener != null) {
          videoCalls.removeUserCallListener(listener);
        }
      }
    }

    class UserChannelListener implements ChannelListener {
      @Override
      public void configureChannel(ConfigurableServerChannel channel) {
        // TODO need something special?
      }

      @Override
      public void channelAdded(ServerChannel channel) {
        // Add sub/unsub listener to VideoCalls channel
        final String channelId = channel.getId();
        if (LOG.isDebugEnabled()) {
          LOG.debug("Channel added: " + channelId);
        }
        if (channelId.startsWith(USER_SUBSCRIPTION_CHANNEL_NAME)) {
          channel.addListener(subscriptionListener);
          // channel.setAttribute(CHANNEL_LISTENER, listener);
          if (LOG.isDebugEnabled()) {
            LOG.debug("Added subscription listener for channel " + channelId);
          }
        }
      }

      @Override
      public void channelRemoved(String channelId) {
        if (LOG.isDebugEnabled()) {
          LOG.debug("Channel removed: " + channelId);
        }
        if (channelId.startsWith(USER_SUBSCRIPTION_CHANNEL_NAME)) {
          // Channel already doesn't exist here, ensure all its client listeners were unregistered
          Set<String> clients = channelClients.remove(channelId);
          if (clients != null) {
            for (String clientId : clients) {
              UserCallListener listener = clientUserListeners.remove(clientId);
              if (listener != null) {
                videoCalls.removeUserCallListener(listener);
                if (LOG.isDebugEnabled()) {
                  LOG.debug("Removed user call listener of client " + clientId + " for channel " + channelId);
                }
              } else {
                LOG.info("Clinet found " + clientId + " but not its user call listener for channel "
                    + channelId);
              }
            }
          }
        }
      }
    }

    @Inject
    private BayeuxServer                        bayeux;

    @Session
    private LocalSession                        localSession;

    @Session
    private ServerSession                       serverSession;

    private final Map<String, UserCallListener> clientUserListeners   = new ConcurrentHashMap<>();

    private final Map<String, Set<String>>      channelClients        = new ConcurrentHashMap<>();

    private final RemoveListener                sessionRemoveListener = new SessionRemoveListener();

    private final ChannelSubscriptionListener   subscriptionListener  = new ChannelSubscriptionListener();

    private final UserChannelListener           channelListener       = new UserChannelListener();

    @PostConstruct
    public void postConstruct() {
      bayeux.addListener(channelListener);
      serverSession.addListener(sessionRemoveListener);
    }

    @PreDestroy
    public void preDestroy() {
      // cleanup listeners
      bayeux.removeListener(channelListener);
      serverSession.removeListener(sessionRemoveListener);
      for (UserCallListener listener : clientUserListeners.values()) {
        videoCalls.removeUserCallListener(listener);
      }
      channelClients.clear();
      clientUserListeners.clear();
    }

    @Subscription(CALL_SUBSCRIPTION_CHANNEL_NAME)
    public void subscribeCalls(Message message, @Param("callId") String callId) {
      LOG.info("Call published in " + message.getChannel() + " by " + message.getClientId() + " callId: "
          + callId + " data: " + message.getJSON());
      // TODO all data exchanged between peers of a call will go there, WebRTC stuff etc.
    }

    @Subscription(USER_SUBSCRIPTION_CHANNEL_NAME)
    public void subscribeUser(Message message, @Param("userId") String userId) {
      final String channelId = message.getChannel();
      LOG.info("User published in " + channelId + " by " + message.getClientId() + " userId: " + userId
          + " data: " + message.getJSON());
      // here will come user publications about his state
    }

    // @Listener(Channel.META_SUBSCRIBE)
    @Deprecated
    public void processSubscription(ServerSession remote, ServerMessage message) {
      // User subscribed
      String clientId = message.getClientId(); // is the same remote.getId() ?
      String[] channels;
      Object subscription = message.get(Message.SUBSCRIPTION_FIELD);
      if (subscription instanceof String[]) {
        channels = (String[]) subscription;
      } else {
        channels = new String[] { (String) subscription };
      }
      for (String channelId : channels) {
        if (channelId.startsWith(USER_SUBSCRIPTION_CHANNEL_NAME)) {
          // add user listener
          try {
            final String userId = channelId.substring(USER_SUBSCRIPTION_CHANNEL_NAME.length() + 1);
            final String currentUserId = currentUserId(message);
            if (currentUserId != null) {
              if (currentUserId.equals(userId)) {
                // Tracking channel-to-clients mapping looks redundant, at first thought client-to-listener is
                // enough,
                // but we keep channel's clients also for understanding consistency during development and
                // debug
                Set<String> clients = channelClients.computeIfAbsent(channelId,
                                                                     k -> ConcurrentHashMap.newKeySet());
                if (clients.contains(clientId) && clientUserListeners.containsKey(clientId)) {
                  LOG.warn("Subscribtion already active, user: " + currentUserId + ", client: " + clientId
                      + ", target: " + channelId);
                  remote.deliver(serverSession,
                                 channelId,
                                 ErrorInfo.clientError("Subscribtion already active").asJSON());
                } else {
                  UserCallListener listener = new UserCallListener(userId) {
                    @Override
                    public void onPartLeaved(String callId, String partId) {
                      StringBuilder data = new StringBuilder();
                      data.append('{');
                      data.append("\"eventType\": \"call_leaved\",");
                      data.append("\"callId\": \"");
                      data.append(callId);
                      data.append("\",\"part\": {");
                      data.append("\"id\": \"");
                      data.append(partId);
                      data.append("\"}");
                      data.append('}');
                      bayeux.getChannel(channelId).publish(serverSession, data.toString());
                    }

                    @Override
                    public void onPartJoined(String callId, String partId) {
                      StringBuilder data = new StringBuilder();
                      data.append('{');
                      data.append("\"eventType\": \"call_joined\",");
                      data.append("\"callId\": \"");
                      data.append(callId);
                      data.append("\",\"part\": {");
                      data.append("\"id\": \"");
                      data.append(partId);
                      data.append("\"}");
                      data.append('}');
                      bayeux.getChannel(channelId).publish(serverSession, data.toString());
                    }

                    @Override
                    public void onCallState(String callId,
                                            String callState,
                                            String callerId,
                                            String callerType) {
                      StringBuilder data = new StringBuilder();
                      data.append('{');
                      data.append("\"eventType\": \"call_state\",");
                      data.append("\"callId\": \"");
                      data.append(callId);
                      data.append('\"');
                      data.append(",\"callState\": \"");
                      data.append(callState);
                      data.append("\",\"caller\": {");
                      data.append("\"id\": \"");
                      data.append(callerId);
                      data.append("\",\"type\": \"");
                      data.append(callerType);
                      data.append("\"}");
                      data.append('}');
                      bayeux.getChannel(channelId).publish(serverSession, data.toString());
                    }

                    @Override
                    public boolean isListening() {
                      return true;
                    }
                  };
                  videoCalls.addUserCallListener(listener);
                  clients.add(clientId);
                  clientUserListeners.put(clientId, listener);
                  // add listener for removed session cleanup
                  remote.addListener(sessionRemoveListener);
                  ServerChannel channel = bayeux.getChannel(channelId);
                  if (channel != null) {
                    channel.addListener(subscriptionListener);
                  }
                  if (LOG.isDebugEnabled()) {
                    LOG.debug("Subscribed user " + userId + " (client:" + clientId + ") to channel "
                        + channelId);
                  }
                }
              } else {
                LOG.warn("Subscribing to other user not possible, user: " + currentUserId + ", target: "
                    + channelId);
                remote.deliver(serverSession,
                               channelId,
                               ErrorInfo.clientError("Subscribing to other user not possible").asJSON());
                ServerChannel channel = bayeux.getChannel(channelId);
                if (channel != null && !channel.unsubscribe(remote)) {
                  LOG.warn("Unable to unsubscribe user " + currentUserId + " from channel " + channelId);
                }
              }
            } else {
              LOG.warn("Subscribing by unauthorized user not possible, was target: " + channelId);
              remote.deliver(serverSession, channelId, ErrorInfo.accessError("Unauthorized user").asJSON());
              ServerChannel channel = bayeux.getChannel(channelId);
              if (channel != null && !channel.unsubscribe(remote)) {
                LOG.warn("Unable to unsubscribe unauthorized user from channel " + channelId);
              }
            }
          } catch (IndexOutOfBoundsException e) {
            // Ignore channel w/o a subpath (userId here) at the end
            if (LOG.isDebugEnabled()) {
              LOG.debug("Ignore channel w/o userId at the end: " + channelId, e);
            }
          }
        }
      }
    }

    // @Listener(Channel.META_UNSUBSCRIBE)
    @Deprecated
    public void processUnsubscription(ServerSession remote, ServerMessage message) {
      // User unsubscribed
      String clientId = message.getClientId();
      String[] channels;
      Object subscription = message.get(Message.SUBSCRIPTION_FIELD);
      if (subscription instanceof String[]) {
        channels = (String[]) subscription;
      } else {
        channels = new String[] { (String) subscription };
      }
      for (String channelId : channels) {
        if (channelId.startsWith(USER_SUBSCRIPTION_CHANNEL_NAME)) {
          try {
            final String userId = channelId.substring(USER_SUBSCRIPTION_CHANNEL_NAME.length() + 1);
            // remove user listener
            final String currentUserId = currentUserId(message);
            if (currentUserId != null) {
              if (currentUserId.equals(userId)) {
                boolean hasClient = channelClients.getOrDefault(channelId, Collections.emptySet())
                                                  .remove(clientId);
                if (hasClient) {
                  UserCallListener listener = clientUserListeners.remove(clientId);
                  if (listener != null) {
                    videoCalls.removeUserCallListener(listener);
                    if (LOG.isDebugEnabled()) {
                      LOG.debug("Unsubscribed user " + userId + " (client:" + clientId + ") from channel "
                          + channelId);
                    }
                  } else {
                    LOG.info("Clinet found " + clientId
                        + " but not its user listener for unsubscribing channel " + channelId);
                  }
                }
              } else {
                LOG.warn("Unsubscribing from other user not possible, user: " + currentUserId + ", target: "
                    + channelId);
                remote.deliver(serverSession,
                               channelId,
                               ErrorInfo.clientError("Unsubscribing from other user not possible").asJSON());
              }
            } else {
              LOG.warn("Unsubscribining by unauthorized user not possible, was target: " + channelId);
            }
          } catch (IndexOutOfBoundsException e) {
            // Ignore channel w/o a subpath (userId here) at the end
            if (LOG.isDebugEnabled()) {
              LOG.debug("Ignore channel w/o userId at the end: " + channelId, e);
            }
          }
        }
      }
    }

    @Configure(CALLS_SERVICE_CHANNEL_NAME)
    public void configureCalls(ConfigurableServerChannel channel) {
      // TODO
      // channel.setLazy(true);
      // channel.addAuthorizer(GrantAuthorizer.GRANT_SUBSCRIBE_PUBLISH);
    }

    // @Listener(CALLS_SERVICE_CHANNEL_NAME)
    @Deprecated
    public void serviceCalls(ServerSession remote, ServerMessage.Mutable message) {
      String channelId = message.getChannel();
      String data = (String) message.getData();

      LOG.info("Call request in " + channelId + " by " + message.getClientId() + ": " + message.getJSON());
      /*
       * {
       * owner : ownerId,
       * ownerType : ownerType,
       * provider : provider.getType(),
       * title : conversation.topic(),
       * participants : userIds.join(";") // eXo user ids here
       * }
       */
      try {
        final String currentUserId = currentUserId(message);
        if (currentUserId != null) {
          JSONObject json = new JSONObject(data);
          String command = json.optString("command");
          if (command != null) { // can be "get", "create", "remove", "update"
            String callId = json.optString("id");
            if (callId != null) {
              if (COMMAND_GET.equals(command)) {
                try {
                  CallInfo call = videoCalls.getCall(callId);
                  if (call != null) {
                    remote.deliver(serverSession, channelId, asJSON(call));
                  } else {
                    remote.deliver(serverSession,
                                   channelId,
                                   ErrorInfo.notFoundError("Call not found").asJSON());
                  }
                } catch (Throwable e) {
                  LOG.error("Error reading call info '" + callId + "' by '" + currentUserId + "'", e);
                  remote.deliver(serverSession,
                                 channelId,
                                 ErrorInfo.serverError("Error reading call record").asJSON());
                }
              } else if (COMMAND_CREATE.equals(command)) {
                String ownerId = json.optString("owner");
                if (ownerId != null) {
                  String ownerType = json.optString("ownerType");
                  if (ownerType != null) {
                    String providerType = json.optString("provider");
                    if (providerType != null) {
                      String title = json.getString("title"); // topic
                      if (title != null) {
                        JSONArray jsonParts = json.optJSONArray("participants");
                        if (jsonParts != null) {
                          String[] participants = new String[jsonParts.length()];
                          for (int i = 0; i < jsonParts.length(); i++) {
                            participants[i] = jsonParts.getString(i);
                          }
                          try {
                            CallInfo call = videoCalls.addCall(callId,
                                                               ownerId,
                                                               ownerType,
                                                               title,
                                                               providerType,
                                                               Arrays.asList(participants));
                            remote.deliver(serverSession, channelId, asJSON(call));
                          } catch (CallInfoException e) {
                            // aka BAD_REQUEST
                            remote.deliver(serverSession,
                                           channelId,
                                           ErrorInfo.clientError(e.getMessage()).asJSON());
                          } catch (JsonException e) {
                            // It's eXo WS JSON Generator error
                            LOG.error("Error generating call response for creation of '" + callId + "' by '"
                                + currentUserId, e);
                            remote.deliver(serverSession,
                                           channelId,
                                           ErrorInfo.serverError("Error generating call response").asJSON());
                          } catch (Throwable e) {
                            LOG.error("Error creating call for '" + callId + "' by '" + currentUserId + "'",
                                      e);
                            remote.deliver(serverSession,
                                           channelId,
                                           ErrorInfo.serverError("Error creating call record").asJSON());
                          }
                        } else {
                          remote.deliver(serverSession,
                                         channelId,
                                         ErrorInfo.clientError("Wrong request parameters: participants")
                                                  .asJSON());
                        }
                      } else {
                        remote.deliver(serverSession,
                                       channelId,
                                       ErrorInfo.clientError("Wrong request parameters: title").asJSON());
                      }
                    } else {
                      remote.deliver(serverSession,
                                     channelId,
                                     ErrorInfo.clientError("Wrong request parameters: provider").asJSON());
                    }
                  } else {
                    remote.deliver(serverSession,
                                   channelId,
                                   ErrorInfo.clientError("Wrong request parameters: ownerType").asJSON());
                  }
                } else {
                  remote.deliver(serverSession,
                                 channelId,
                                 ErrorInfo.clientError("Wrong request parameters: owner").asJSON());
                }
              } else if (COMMAND_UPDATE.equals(command)) {
                String state = json.optString("state");
                if (state != null) {
                  try {
                    if (CallState.STOPPED.equals(state)) {
                      CallInfo call = videoCalls.stopCall(callId, false);
                      if (call != null) {
                        remote.deliver(serverSession, channelId, asJSON(call));
                      } else {
                        // NOT_FOUND
                        remote.deliver(serverSession,
                                       channelId,
                                       ErrorInfo.notFoundError("Call not found").asJSON());
                      }
                    } else if (CallState.STARTED.equals(state)) {
                      CallInfo call = videoCalls.startCall(callId);
                      if (call != null) {
                        remote.deliver(serverSession, channelId, asJSON(call));
                      } else {
                        // NOT_FOUND
                        remote.deliver(serverSession,
                                       channelId,
                                       ErrorInfo.notFoundError("Call not found").asJSON());
                      }
                    } else {
                      remote.deliver(serverSession,
                                     channelId,
                                     ErrorInfo.clientError("Wrong request parameters: state not recognized")
                                              .asJSON());
                    }
                  } catch (JsonException e) {
                    // It's eXo WS JSON Generator error
                    LOG.error("Error generating call response for update of '" + callId + "' by '"
                        + currentUserId, e);
                    remote.deliver(serverSession,
                                   channelId,
                                   ErrorInfo.serverError("Error generating call response").asJSON());
                  } catch (Throwable e) {
                    LOG.error("Error updating call info '" + callId + "' by '" + currentUserId + "'", e);
                    remote.deliver(serverSession,
                                   channelId,
                                   ErrorInfo.serverError("Error updating call record").asJSON());
                  }
                } else {
                  remote.deliver(serverSession,
                                 channelId,
                                 ErrorInfo.clientError("Wrong request parameters: state").asJSON());
                }
              } else if (COMMAND_DELETE.equals(command)) {
                try {
                  CallInfo call = videoCalls.stopCall(callId, true);
                  if (call != null) {
                    remote.deliver(serverSession, channelId, asJSON(call));
                  } else {
                    // NOT_FOUND
                    remote.deliver(serverSession,
                                   channelId,
                                   ErrorInfo.notFoundError("Call not found").asJSON());
                  }
                } catch (JsonException e) {
                  // It's eXo WS JSON Generator error
                  LOG.error("Error generating call response for deletion of '" + callId + "' by '"
                      + currentUserId, e);
                  remote.deliver(serverSession,
                                 channelId,
                                 ErrorInfo.serverError("Error generating call response").asJSON());
                } catch (Throwable e) {
                  LOG.error("Error deleting call '" + callId + "' by '" + currentUserId + "'", e);
                  remote.deliver(serverSession,
                                 channelId,
                                 ErrorInfo.serverError("Error deleting call record").asJSON());
                }
              } else {
                LOG.warn("Unknown call command for '" + callId + "' from '" + currentUserId + "': "
                    + command);
                remote.deliver(serverSession, channelId, ErrorInfo.clientError("Unknown command").asJSON());
              }
            } else {
              remote.deliver(serverSession,
                             channelId,
                             ErrorInfo.clientError("Wrong request parameters: id").asJSON());
            }
          } else {
            remote.deliver(serverSession,
                           channelId,
                           ErrorInfo.clientError("Wrong request parameters: command").asJSON());
          }
        } else {
          remote.deliver(serverSession, channelId, ErrorInfo.clientError("Unauthorized user").asJSON());
        }
      } catch (JSONException e) {
        // It's error of reading request JSON
        LOG.error("Error parsing call request", e);
        remote.deliver(serverSession,
                       channelId,
                       ErrorInfo.serverError("Error parsing call request").asJSON());
      }
    }

    @RemoteCall(CALLS_CHANNEL_NAME)
    public void rcCalls(final RemoteCall.Caller caller, final Object data) {
      final ServerSession session = caller.getServerSession();
      if (LOG.isDebugEnabled()) {
        LOG.debug("Calls remote call by " + session.getId() + " data: " + data);
      }

      // TODO use thread pool (take in account CPUs number of cores etc)
      new Thread(new Runnable() {
        @SuppressWarnings("deprecation")
        @Override
        public void run() {
          try {
            @SuppressWarnings("unchecked")
            Map<String, Object> arguments = (Map<String, Object>) data;
            String currentUserId = (String) arguments.get("exoId");
            if (currentUserId != null) {
              String containerName = (String) arguments.get("exoContainerName");
              if (containerName != null) {
                // Do all the job under actual (requester) user: set this user as current identity in eXo
                // XXX We rely on EXoContinuationBayeux.EXoSecurityPolicy for user security here (exoId above)
                // We also set user's eXo container in the context (for proper work of eXo apps, like Social
                // identity)
                ExoContainer exoContainer = ExoContainerContext.getContainerByName(containerName);
                if (exoContainer != null) {
                  ExoContainer contextContainer = ExoContainerContext.getCurrentContainerIfPresent();
                  try {
                    // User context (1)
                    ExoContainerContext.setCurrentContainer(exoContainer);
                    // Use services acquired from context container
                    IdentityRegistry identityRegistry =
                                                      exoContainer.getComponentInstanceOfType(IdentityRegistry.class);
                    SessionProviderService sessionProviders =
                                                            exoContainer.getComponentInstanceOfType(SessionProviderService.class);
                    VideoCallsService videoCalls =
                                                 exoContainer.getComponentInstanceOfType(VideoCallsService.class);
                    // TODO should we check for NPE of the above services?
                    Identity userIdentity = identityRegistry.getIdentity(currentUserId);
                    if (userIdentity != null) {
                      ConversationState contextState = ConversationState.getCurrent();
                      SessionProvider contextProvider = sessionProviders.getSessionProvider(null);
                      try {
                        // User context (2)
                        ConversationState convState = new ConversationState(userIdentity);
                        convState.setAttribute(ConversationState.SUBJECT, userIdentity.getSubject());
                        ConversationState.setCurrent(convState);
                        SessionProvider userProvider = new SessionProvider(convState);
                        sessionProviders.setSessionProvider(null, userProvider);
                        // Process the request
                        String id = (String) arguments.get("id");
                        if (id != null) {
                          String command = (String) arguments.get("command");
                          if (command != null) {
                            if (COMMAND_GET.equals(command)) {
                              try {
                                CallInfo call = videoCalls.getCall(id);
                                if (call != null) {
                                  caller.result(asJSON(call));
                                } else {
                                  caller.failure(ErrorInfo.notFoundError("Call not found").asJSON());
                                }
                              } catch (Throwable e) {
                                LOG.error("Error reading call info '" + id + "' by '" + currentUserId + "'",
                                          e);
                                caller.failure(ErrorInfo.serverError("Error reading call record").asJSON());
                              }
                            } else if (COMMAND_UPDATE.equals(command)) {
                              String state = (String) arguments.get("state");
                              if (state != null) {
                                try {
                                  boolean stateRecognized = true;
                                  CallInfo call;
                                  if (CallState.STARTED.equals(state)) {
                                    call = videoCalls.startCall(id);
                                  } else if (CallState.STOPPED.equals(state)) {
                                    call = videoCalls.stopCall(id, false);
                                  } else if (UserState.JOINED.equals(state)) {
                                    call = videoCalls.joinCall(id, currentUserId);
                                  } else if (UserState.LEAVED.equals(state)) {
                                    call = videoCalls.leaveCall(id, currentUserId);
                                  } else {
                                    call = null;
                                    stateRecognized = false;
                                  }
                                  if (stateRecognized) {
                                    if (call != null) {
                                      caller.result(asJSON(call));
                                    } else {
                                      caller.failure(ErrorInfo.notFoundError("Call not found").asJSON());
                                    }
                                  } else {
                                    caller.failure(ErrorInfo.clientError("Wrong request parameters: state not recognized")
                                                            .asJSON());
                                  }
                                } catch (Throwable e) {
                                  LOG.error("Error updating call '" + id + "' by '" + currentUserId + "'", e);
                                  caller.failure(ErrorInfo.serverError("Error updating call record")
                                                          .asJSON());
                                }
                              } else {
                                caller.failure(ErrorInfo.clientError("Wrong request parameters: state")
                                                        .asJSON());
                              }
                            } else if (COMMAND_CREATE.equals(command)) {
                              String ownerId = (String) arguments.get("owner");
                              if (ownerId != null) {
                                String ownerType = (String) arguments.get("ownerType");
                                if (ownerType != null) {
                                  String providerType = (String) arguments.get("provider");
                                  if (providerType != null) {
                                    String title = (String) arguments.get("title"); // topic
                                    if (title != null) {
                                      String pstr = (String) arguments.get("participants");
                                      if (pstr != null) {
                                        List<String> participants = Arrays.asList(pstr.split(";"));
                                        try {
                                          CallInfo call =
                                                        videoCalls.addCall(id,
                                                                           ownerId,
                                                                           ownerType,
                                                                           title,
                                                                           providerType,
                                                                           participants);
                                          caller.result(asJSON(call));
                                        } catch (CallInfoException e) {
                                          // aka BAD_REQUEST
                                          caller.failure(ErrorInfo.clientError(e.getMessage()).asJSON());
                                        } catch (Throwable e) {
                                          LOG.error("Error creating call for '" + id + "' by '"
                                              + currentUserId + "'", e);
                                          caller.failure(ErrorInfo.serverError("Error creating call record")
                                                                  .asJSON());
                                        }
                                      } else {
                                        caller.failure(ErrorInfo.clientError("Wrong request parameters: participants")
                                                                .asJSON());
                                      }
                                    } else {
                                      caller.failure(ErrorInfo.clientError("Wrong request parameters: title")
                                                              .asJSON());
                                    }
                                  } else {
                                    caller.failure(ErrorInfo.clientError("Wrong request parameters: provider")
                                                            .asJSON());
                                  }
                                } else {
                                  caller.failure(ErrorInfo.clientError("Wrong request parameters: ownerType")
                                                          .asJSON());
                                }
                              } else {
                                caller.failure(ErrorInfo.clientError("Wrong request parameters: owner")
                                                        .asJSON());
                              }
                            } else if (COMMAND_DELETE.equals(command)) {
                              try {
                                CallInfo call = videoCalls.stopCall(id, true);
                                if (call != null) {
                                  caller.result(asJSON(call));
                                } else {
                                  caller.failure(ErrorInfo.notFoundError("Call not found").asJSON());
                                }
                              } catch (Throwable e) {
                                LOG.error("Error deleting call '" + id + "' by '" + currentUserId + "'", e);
                                caller.failure(ErrorInfo.serverError("Error deleting call record").asJSON());
                              }
                            } else if (COMMAND_GET_CALLS_STATE.equals(command)) {
                              String userId;
                              if (IdentityInfo.ME.equals(id)) {
                                userId = currentUserId;
                              } else {
                                userId = id;
                              }
                              if (userId.equals(currentUserId)) {
                                try {
                                  CallState[] calls = videoCalls.getUserCalls(userId);
                                  caller.result(asJSON(calls));
                                } catch (Throwable e) {
                                  LOG.error("Error reading users calls for '" + id + "'", e);
                                  caller.failure(ErrorInfo.serverError("Error reading users calls").asJSON());
                                }
                              } else {
                                // Don't let read other user calls
                                caller.failure(ErrorInfo.clientError("Wrong request parameters: id (does not match)")
                                                        .asJSON());
                              }
                            } else {
                              LOG.warn("Unknown call command " + command + " for '" + id + "' from '"
                                  + currentUserId + "'");
                              caller.failure(ErrorInfo.clientError("Unknown command").asJSON());
                            }
                          } else {
                            caller.failure(ErrorInfo.clientError("Wrong request parameters: command")
                                                    .asJSON());
                          }
                        } else {
                          caller.failure(ErrorInfo.clientError("Wrong request parameters: id").asJSON());
                        }
                      } finally {
                        // Restore context (2)
                        ConversationState.setCurrent(contextState);
                        sessionProviders.setSessionProvider(null, contextProvider);
                      }
                    } else {
                      LOG.warn("User identity not found " + currentUserId + " for remote call of "
                          + CALLS_CHANNEL_NAME);
                      caller.failure(ErrorInfo.clientError("User identity not found").asJSON());
                    }
                  } finally {
                    // Restore context (1)
                    ExoContainerContext.setCurrentContainer(contextContainer);
                  }
                } else {
                  LOG.warn("Container not found " + containerName + " for remote call of "
                      + CALLS_CHANNEL_NAME);
                  caller.failure(ErrorInfo.clientError("Container not found").asJSON());
                }
              } else {
                caller.failure(ErrorInfo.clientError("Container required").asJSON());
              }
            } else {
              caller.failure(ErrorInfo.clientError("Unauthorized user").asJSON());
            }
          } catch (Throwable e) {
            LOG.error("Error processing call request from client " + session.getId() + " with data: " + data,
                      e);
            caller.failure(ErrorInfo.serverError("Error processing call request: " + e.getMessage())
                                    .asJSON());
          }
        }
      }).start();
    }

  }

  /**
   * Instantiates a new CometD interaction service for VideoCalls.
   *
   * @param videoCalls the video calls
   */
  public CometdVideoCallsService(SessionProviderService sessionProviders,
                                 IdentityRegistry identityRegistry,
                                 OrganizationService organization,
                                 VideoCallsService videoCalls,
                                 EXoContinuationBayeux exoBayeux) {
    this.sessionProviders = sessionProviders;
    this.identityRegistry = identityRegistry;
    this.organization = organization;
    this.videoCalls = videoCalls;
    this.exoBayeux = exoBayeux;
    this.service = new CallService();
  }

  @Override
  public void start() {
    // instantiate processor after the eXo container start, to let start-dependent logic worked before us
    final AtomicReference<ServerAnnotationProcessor> processor = new AtomicReference<>();
    // need initiate process after Bayeux server starts
    exoBayeux.addLifeCycleListener(new LifeCycle.Listener() {
      @Override
      public void lifeCycleStarted(LifeCycle event) {
        ServerAnnotationProcessor p = new ServerAnnotationProcessor(exoBayeux);
        processor.set(p);
        p.process(service);
      }

      @Override
      public void lifeCycleStopped(LifeCycle event) {
        ServerAnnotationProcessor p = processor.get();
        if (p != null) {
          p.deprocess(service);
        }
      }

      @Override
      public void lifeCycleStarting(LifeCycle event) {
        // Nothing
      }

      @Override
      public void lifeCycleFailure(LifeCycle event, Throwable cause) {
        // Nothing
      }

      @Override
      public void lifeCycleStopping(LifeCycle event) {
        // Nothing
      }
    });
    // TODO This listener not required for work?
    exoBayeux.addListener(new BayeuxServer.SessionListener() {
      @Override
      public void sessionRemoved(ServerSession session, boolean timedout) {
        // Nothing?
        if (LOG.isDebugEnabled()) {
          LOG.debug("sessionRemoved: " + session.getId() + " timedout:" + timedout + " channels: "
              + channelsAsString(session.getSubscriptions()));
        }
      }

      @Override
      public void sessionAdded(ServerSession session, ServerMessage message) {
        if (LOG.isDebugEnabled()) {
          LOG.debug("sessionAdded: " + session.getId() + " channels: "
              + channelsAsString(session.getSubscriptions()));
        }
      }
    });
  }

  @Override
  public void stop() {
    //
  }

  /**
   * Gets the cometd server path.
   *
   * @return the cometd server path
   */
  public String getCometdServerPath() {
    return new StringBuilder("/").append(exoBayeux.getCometdContextName()).append("/cometd").toString();
  }

  /**
   * Gets the user token.
   *
   * @param userId the user id
   * @return the user token
   */
  public String getUserToken(String userId) {
    return exoBayeux.getUserToken(userId);
  }

  /**
   * Current user id.
   *
   * @param message the message
   * @return the string, if user cannot be defined it will be {@link IdentityConstants#ANONIM}
   */
  protected String currentUserId(ServerMessage message) {
    // FIXME Should we rely at ConversationState current's here or only on message's exoId?
    if (message != null) {
      return (String) message.get("exoId");
    } else {
      ConversationState convo = ConversationState.getCurrent();
      if (convo != null) {
        return convo.getIdentity().getUserId();
      } else {
        return IdentityConstants.ANONIM;
      }
    }
  }

  /**
   * Channel user id. It's assumed an user channel {@link USER_SUBSCRIPTION_CHANNEL_NAME}.
   *
   * @param channelId the channel id
   * @return the string
   * @throws IndexOutOfBoundsException if channel id doesn't look like an user channel
   */
  protected String channelUserId(String channelId) throws IndexOutOfBoundsException {
    return channelId.substring(USER_SUBSCRIPTION_CHANNEL_NAME.length() + 1);
  }

  protected String channelsAsString(Set<ServerChannel> channles) {
    return channles.stream().map(c -> c.getId()).collect(Collectors.joining(", "));
  }
}
