
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
package org.exoplatform.videocalls;

import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.exoplatform.commons.api.settings.SettingService;
import org.exoplatform.commons.api.settings.SettingValue;
import org.exoplatform.commons.api.settings.data.Context;
import org.exoplatform.commons.api.settings.data.Scope;
import org.exoplatform.container.ExoContainerContext;
import org.exoplatform.container.component.ComponentPlugin;
import org.exoplatform.services.cms.drives.ManageDriveService;
import org.exoplatform.services.jcr.RepositoryService;
import org.exoplatform.services.jcr.ext.app.SessionProviderService;
import org.exoplatform.services.jcr.ext.hierarchy.NodeHierarchyCreator;
import org.exoplatform.services.listener.ListenerService;
import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;
import org.exoplatform.services.organization.OrganizationService;
import org.exoplatform.services.organization.User;
import org.exoplatform.services.security.ConversationState;
import org.exoplatform.social.core.identity.model.Identity;
import org.exoplatform.social.core.identity.model.Profile;
import org.exoplatform.social.core.identity.provider.OrganizationIdentityProvider;
import org.exoplatform.social.core.manager.IdentityManager;
import org.exoplatform.social.core.service.LinkProvider;
import org.exoplatform.social.core.space.model.Space;
import org.exoplatform.social.core.space.spi.SpaceService;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.picocontainer.Startable;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeService.java 00000 Feb 22, 2017 pnedonosko $
 */
public class VideoCallsService implements Startable {

  /** The Constant SPACE_TYPE_NAME. */
  public static final String    SPACE_TYPE_NAME       = "space".intern();

  /** The Constant CHAT_ROOM_TYPE_NAME. */
  public static final String    CHAT_ROOM_TYPE_NAME   = "chat_room".intern();

  /** The Constant GROUP_CALL_TYPE. */
  protected static final String GROUP_CALL_TYPE       = "group".intern();

  /** The Constant CALL_OWNER_SCOPE_NAME. */
  protected static final String CALL_OWNER_SCOPE_NAME = "videocalls.callOwner".intern();

  /** The Constant CALL_ID_SCOPE_NAME. */
  protected static final String CALL_ID_SCOPE_NAME    = "videocalls.callId".intern();

  /** The Constant USER_CALLS_SCOPE_NAME. */
  protected static final String USER_CALLS_SCOPE_NAME = "videocalls.user.calls".intern();

  /**
   * The Class SpaceInfo.
   */
  public class SpaceInfo extends GroupInfo {

    /** The space group id. */
    protected final String groupId;

    /**
     * Instantiates a new space info.
     *
     * @param socialSpace the social space
     */
    public SpaceInfo(Space socialSpace) {
      super(socialSpace.getPrettyName(), socialSpace.getDisplayName());
      this.groupId = socialSpace.getGroupId();
    }

    /**
     * Gets the group id of the space.
     *
     * @return the groupId
     */
    public String getGroupId() {
      return groupId;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getType() {
      return SPACE_TYPE_NAME;
    }
  }

  /**
   * The Class RoomInfo.
   */
  public class RoomInfo extends GroupInfo {

    /** The pretty name. */
    protected final String name;

    /**
     * Instantiates a new room info.
     *
     * @param id the id
     * @param name the name, it's pretty name of the room (like what spaces have)
     * @param title the title
     */
    public RoomInfo(String id, String name, String title) {
      super(id, title);
      this.name = name;
    }

    /**
     * Gets the pretty name.
     *
     * @return the name
     */
    public String getName() {
      return name;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getType() {
      return CHAT_ROOM_TYPE_NAME;
    }
  }

  /** The Constant OWNER_TYPE_SPACE. */
  public static final String                         OWNER_TYPE_SPACE    = "space";

  /** The Constant OWNER_TYPE_CHATROOM. */
  public static final String                         OWNER_TYPE_CHATROOM = "chat_room";

  /** The Constant LOG. */
  protected static final Log                         LOG                 =
                                                         ExoLogger.getLogger(VideoCallsService.class);

  /** The jcr service. */
  protected final RepositoryService                  jcrService;

  /** The session providers. */
  protected final SessionProviderService             sessionProviders;

  /** The hierarchy owner. */
  protected final NodeHierarchyCreator               hierarchyCreator;

  /** The organization. */
  protected final OrganizationService                organization;

  /** The social identity manager. */
  protected final IdentityManager                    socialIdentityManager;

  /** The drive service. */
  protected final ManageDriveService                 driveService;

  /** The listener service. */
  protected final ListenerService                    listenerService;

  /** The settings service. */
  protected final SettingService                     settingService;

  /** The providers. */
  protected final Map<String, VideoCallsProvider>    providers           = new ConcurrentHashMap<>();

  /** The space service. */
  protected SpaceService                             spaceService;

  /** The user listeners. */
  protected final Map<String, Set<UserCallListener>> userListeners       = new ConcurrentHashMap<>();

  /**
   * Instantiates a new VideoCalls service.
   *
   * @param jcrService the jcr service
   * @param sessionProviders the session providers
   * @param hierarchyCreator the hierarchy owner
   * @param organization the organization
   * @param socialIdentityManager the social identity manager
   * @param driveService the drive service
   * @param listenerService the listener service
   * @param settingService the settings service
   */
  public VideoCallsService(RepositoryService jcrService,
                           SessionProviderService sessionProviders,
                           NodeHierarchyCreator hierarchyCreator,
                           OrganizationService organization,
                           IdentityManager socialIdentityManager,
                           ManageDriveService driveService,
                           ListenerService listenerService,
                           SettingService settingService) {
    this.jcrService = jcrService;
    this.sessionProviders = sessionProviders;
    this.hierarchyCreator = hierarchyCreator;
    this.organization = organization;
    this.socialIdentityManager = socialIdentityManager;
    this.driveService = driveService;
    this.listenerService = listenerService;
    this.settingService = settingService;
  }

  /**
   * Gets the user info.
   *
   * @param id the id
   * @return the user info
   * @throws Exception the exception
   */
  public UserInfo getUserInfo(String id) throws Exception {
    User user = organization.getUserHandler().findUserByName(id);
    Identity userIdentity = socialIdentityManager.getOrCreateIdentity(OrganizationIdentityProvider.NAME,
                                                                      id,
                                                                      true);
    if (user != null) {
      if (userIdentity != null) {
        Profile socialProfile = socialIdentityManager.getProfile(userIdentity);
        @SuppressWarnings("unchecked")
        List<Map<String, String>> ims =
                                      (List<Map<String, String>>) socialProfile.getProperty(Profile.CONTACT_IMS);
        UserInfo info = new UserInfo(user.getUserName(), user.getFirstName(), user.getLastName());
        if (ims != null) {
          for (Map<String, String> m : ims) {
            String imType = m.get("key");
            String imId = m.get("value");
            if (imId != null && imId.length() > 0) {
              VideoCallsProvider provider = getProvider(imType);
              if (provider != null && provider.isSupportedType(imType)) {
                try {
                  info.addImAccount(provider.getIMInfo(imId));
                } catch (VideoCallsProviderException e) {
                  LOG.warn(e.getMessage());
                }
              }
            }
          }
        }
        info.setAvatarUri(socialProfile.getAvatarUrl());
        info.setProfileUri(LinkProvider.getUserProfileUri(id));
        return info;
      } else {
        // TODO exception here?
        LOG.warn("Social identity not found for " + user.getUserName() + " (" + user.getFirstName() + " "
            + user.getLastName() + ")");
      }
    } else {
      // TODO exception here?
      LOG.warn("User not found: " + id);
    }
    return null;
  }

  /**
   * Gets the space info.
   *
   * @param spacePrettyName the space pretty name
   * @return the space info
   * @throws Exception the exception
   */
  public SpaceInfo getSpaceInfo(String spacePrettyName) throws Exception {
    Space socialSpace = spaceService.getSpaceByPrettyName(spacePrettyName);
    SpaceInfo space = new SpaceInfo(socialSpace);
    for (String sm : socialSpace.getMembers()) {
      UserInfo user = getUserInfo(sm);
      if (user != null) {
        space.addMember(user);
      }
    }
    space.setCallId(readOwnerCallId(spacePrettyName));
    return space;
  }

  /**
   * Gets the room info.
   *
   * @param id the id
   * @param name the name
   * @param title the title
   * @param members the room members
   * @return the room info
   * @throws Exception the exception
   */
  public RoomInfo getRoomInfo(String id, String name, String title, String[] members) throws Exception {
    RoomInfo room = roomInfo(id, name, title, members, readOwnerCallId(id));
    return room;
  };

  /**
   * Adds the call to list of active and fires STARTED event.
   *
   * @param id the id
   * @param ownerId the owner id
   * @param ownerType the owner type
   * @param title the title
   * @param providerType the provider type
   * @param parts the parts
   * @return the call info
   * @throws Exception the exception
   */
  public CallInfo addCall(String id,
                          String ownerId,
                          String ownerType,
                          String title,
                          String providerType,
                          Collection<String> parts) throws Exception {
    final boolean isUser = UserInfo.TYPE_NAME.equals(ownerType);
    final boolean isSpace = OWNER_TYPE_SPACE.equals(ownerType);
    final boolean isRoom = OWNER_TYPE_CHATROOM.equals(ownerType);
    final String ownerUri, ownerAvatar;
    final IdentityInfo owner;
    if (isUser) {
      UserInfo userInfo = getUserInfo(ownerId);
      if (userInfo == null) {
        // if owner user not found, it's possibly an external user, thus treat it as a chat room
        owner = new RoomInfo(ownerId, ownerId, title);
        ownerUri = IdentityInfo.EMPTY;
        ownerAvatar = LinkProvider.PROFILE_DEFAULT_AVATAR_URL;
      } else {
        owner = userInfo;
        ownerUri = userInfo.getProfileUri();
        String avatar = userInfo.getAvatarUri();
        ownerAvatar = avatar != null ? avatar : LinkProvider.PROFILE_DEFAULT_AVATAR_URL;
      }
    } else if (isSpace) {
      Space space = spaceService.getSpaceByPrettyName(ownerId);
      if (space != null) {
        owner = new SpaceInfo(space);
        ownerUri = space.getUrl();
        String avatar = space.getAvatarUrl();
        ownerAvatar = avatar != null ? avatar : LinkProvider.SPACE_DEFAULT_AVATAR_URL;
      } else {
        LOG.warn("Cannot find call's owner space " + ownerId);
        owner = new RoomInfo(ownerId, ownerId, title);
        ownerUri = IdentityInfo.EMPTY;
        ownerAvatar = LinkProvider.SPACE_DEFAULT_AVATAR_URL;
      }
    } else if (isRoom) {
      owner = new RoomInfo(ownerId, ownerId, title);
      // XXX room members stay empty
      ownerUri = IdentityInfo.EMPTY;
      ownerAvatar = LinkProvider.SPACE_DEFAULT_AVATAR_URL;
    } else {
      throw new CallInfoException("Wrong call owner type: " + ownerType);
    }
    Set<UserInfo> participants = new LinkedHashSet<>();
    for (String pid : parts) {
      UserInfo part = getUserInfo(pid);
      if (part != null) {
        // it's eXo user
        participants.add(part);
      } else {
        // external participant
        participants.add(new ParticipantInfo(providerType, pid));
      }
    }

    // Save the call
    CallInfo call = new CallInfo(id, title, owner, ownerType, ownerUri, ownerAvatar, providerType);
    call.addParticipants(participants);
    call.setState(CallState.STARTED);
    String prevId = readOwnerCallId(ownerId);
    saveCall(call);
    String userId = currentUserId();
    if (isSpace || isRoom) {
      // it's group call
      saveOwnerCallId(ownerId, id);
      for (UserInfo part : participants) {
        if (part.getType() == UserInfo.TYPE_NAME) {
          if (prevId != null) {
            // XXX For a case when some client failed to delete an existing (but outdated etc.) call but
            // already starting a new one
            // It's SfB usecase when browser client failed to delete outdated call (browser/plugin crashed in
            // IE11) and then starts a new one
            removeUserGroupCallId(part.getId(), prevId);
          }
          saveUserGroupCallId(part.getId(), id);
          if (!userId.equals(part.getId())) {
            // fire group's user listener for incoming, except of the caller
            fireUserCallState(part.getId(), id, providerType, CallState.STARTED, ownerId, ownerType);
          }
        }
      }
    } else if (isUser) {
      // It's P2P call
      notifyUserCallState(call, userId, CallState.STARTED);
    }

    return call;
  }

  /**
   * Gets an active call info.
   *
   * @param id the id
   * @return the call info or <code>null</code> if call not found
   * @throws Exception the exception
   */
  public CallInfo getCall(String id) throws Exception {
    return readCallById(id);
  }

  /**
   * Removes the call info from active and fires STOPPED event.
   *
   * @param id the id
   * @param remove the remove
   * @return the call info or <code>null</code> if call not found
   * @throws Exception the exception
   */
  public CallInfo stopCall(String id, boolean remove) throws Exception {
    String userId = currentUserId();
    CallInfo info = readCallById(id);
    if (info != null) {
      stopCall(info, userId, remove);
    } else if (remove) {
      // XXX for a case of previous version storage format, cleanup saved call ID
      if (userId != null && id.startsWith("g/")) {
        removeUserGroupCallId(userId, id);
      }
    }
    return info;
  }

  protected CallInfo stopCall(CallInfo call, String userId, boolean remove) throws Exception {
    // TODO exception if user not a participant?
    if (remove) {
      deleteCall(call);
    } else {
      call.setState(CallState.STOPPED);
      saveCall(call);
    }
    if (call.getOwner().isGroup()) {
      String callId = call.getId();
      for (UserInfo part : call.getParticipants()) {
        if (part.getType() == UserInfo.TYPE_NAME) {
          // It's eXo user: fire user listener for stopped call,
          // but, in case if stopped with removal (deleted call), not to the initiator (of deletion)
          // - a given user.
          // A given user also can be null when not possible to define it (e.g. on CometD channel removal, or
          // other server side action) - then we notify to all participants.
          if (userId == null || !(remove && userId.equals(part.getId()))) {
            fireUserCallState(part.getId(),
                              call.getId(),
                              call.getProviderType(),
                              CallState.STOPPED,
                              call.getOwner().getId(),
                              call.getOwner().getType());
          }
          if (remove) {
            // remove from participant's group calls
            removeUserGroupCallId(part.getId(), callId);
          }
        }
      }
    } else {
      notifyUserCallState(call, userId, CallState.STOPPED);
    }
    return call;
  }

  /**
   * Removes the call info from active and fires STOPPED event.
   *
   * @param id the id
   * @return the call info or <code>null</code> if call not found
   * @throws Exception the exception
   */
  public CallInfo startCall(String id) throws Exception {
    // TODO exception if user not a participant?
    CallInfo call = readCallById(id);
    if (call != null) {
      call.setState(CallState.STARTED);
      if (call.getOwner().isGroup()) {
        String userId = currentUserId();
        for (UserInfo part : call.getParticipants()) {
          if (part.getType() == UserInfo.TYPE_NAME) {
            if (userId.equals(part.getId())) {
              part.setState(UserState.JOINED);
            } else {
              // it's eXo user: fire user listener for started call, but not to the starter (current user)
              fireUserCallState(part.getId(),
                                id,
                                call.getProviderType(),
                                CallState.STARTED,
                                call.getOwner().getId(),
                                call.getOwner().getType());
            }
          }
        }
      }
      saveCall(call);
    }
    return call;
  }

  /**
   * If call started, then notify all its parties that given participant joined. If stopped, then
   * {@link InvalidCallStateException} will be thrown.
   *
   * @param id the id
   * @return the call info or <code>null</code> if call not found
   * @throws Exception the exception
   */
  public CallInfo joinCall(String id, String userId) throws Exception {
    // TODO exception if user not a participant?
    CallInfo call = readCallById(id);
    if (call != null) {
      if (CallState.STARTED.equals(call.getState())) {
        // if (info.getOwner().isGroup()) {
        for (UserInfo part : call.getParticipants()) {
          if (part.getType() == UserInfo.TYPE_NAME) {
            if (userId.equals(part.getId())) {
              part.setState(UserState.JOINED);
              saveCall(call);
            }
            // Fire user joined to all parts, including the user itself
            fireUserCallJoined(id, call.getProviderType(), userId, part.getId());
          }
        }
        // }
      } else {
        startCall(id);
      }
    }
    return call;
  }

  /**
   * If call started, then notify all its parties that given participant leaved. If stopped, then
   * {@link InvalidCallStateException} will be thrown.
   *
   *
   * @param id the id
   * @return the call info or <code>null</code> if call not found
   * @throws Exception the exception
   */
  public CallInfo leaveCall(String id, String userId) throws Exception {
    // TODO exception if user not a participant?
    CallInfo call = readCallById(id);
    if (call != null) {
      if (CallState.STARTED.equals(call.getState())) {
        int leaved = 0;
        boolean userLeaved = false;
        for (UserInfo part : call.getParticipants()) {
          if (part.getType() == UserInfo.TYPE_NAME) {
            if (userId.equals(part.getId())) {
              part.setState(UserState.LEAVED);
              userLeaved = true;
              leaved++;
            } else {
              // if null - user hasn't joined
              if (part.getState() == null || part.getState().equals(UserState.LEAVED)) {
                leaved++;
              }
            }
            // Fire user leaved to all parts, including the user itself
            fireUserCallLeaved(id, call.getProviderType(), userId, part.getId());
          }
        }
        if (leaved == call.getParticipants().size()) {
          stopCall(call, userId, false);
        } else {
          if (userLeaved) {
            saveCall(call);
          }
        }
      } else {
        // It seems has no big sense to return error for already stopped call
        // XXX throw new InvalidCallStateException("Call not started");
      }
    }
    return call;
  }

  /**
   * Gets the user calls.
   *
   * @param userId the user id
   * @return the user call states
   * @throws Exception the exception
   */
  public CallState[] getUserCalls(String userId) throws Exception {
    CallState[] states;
    String[] calls = readUserGroupCallIds(userId);
    if (calls == null) {
      states = new CallState[0];
    } else {
      List<CallState> slist = new ArrayList<CallState>();
      for (String id : calls) {
        if (id.length() > 0) {
          CallInfo call = readCallById(id);
          if (call != null) {
            slist.add(new CallState(id, call.getState() != null ? call.getState() : CallState.STOPPED));
          } else {
            removeUserGroupCallId(userId, id);
            LOG.warn("User call not found: " + id + ". Cleaned user: " + userId);
          }
        }
      }
      states = slist.toArray(new CallState[slist.size()]);
    }
    return states;
  }

  /**
   * Adds the user listener.
   *
   * @param listener the listener
   */
  public void addUserCallListener(UserCallListener listener) {
    final String userId = listener.getUserId();
    userListeners.computeIfAbsent(userId, k -> new LinkedHashSet<>()).add(listener);
  }

  /**
   * Removes the user listener.
   *
   * @param listener the listener
   */
  public void removeUserCallListener(UserCallListener listener) {
    final String userId = listener.getUserId();
    Set<UserCallListener> listeners = userListeners.get(userId);
    if (listeners != null) {
      listeners.remove(listener);
    }
  }

  /**
   * Fire user call state.
   *
   * @param userId the user id
   * @param callId the call id
   * @param providerType the provider type
   * @param callState the call state
   * @param callerId the caller id
   * @param callerType the caller type
   */
  protected void fireUserCallState(String userId,
                                   String callId,
                                   String providerType,
                                   String callState,
                                   String callerId,
                                   String callerType) {
    // Synchronize on userListeners to have a consistent list of listeners to fire
    Set<UserCallListener> listeners = userListeners.get(userId);
    if (listeners != null) {
      for (UserCallListener listener : listeners) {
        // TODO we may lose events: when one request is completing pooling with some event, the listener will
        // stop listen and next one will be registered after some period - this time events will not be
        // delivered to the client.
        // As a solution, we need a temporal pool to save (deferred) events for given user
        // (listener.getUserId()) until it will send a new request or the pool expired
        if (listener.isListening()) {
          listener.onCallState(callId, providerType, callState, callerId, callerType);
        }
      }
    }
  }

  /**
   * Fire user call joined a new part.
   * 
   * @param callId the call id
   * @param providerType the provider type
   * @param partId the part id
   * @param userId the user id
   */
  protected void fireUserCallJoined(String callId, String providerType, String partId, String userId) {
    Set<UserCallListener> listeners = userListeners.get(userId);
    if (listeners != null) {
      for (UserCallListener listener : listeners) {
        if (listener.isListening()) {
          listener.onPartJoined(callId, providerType, partId);
        }
      }
    }
  }

  /**
   * Fire user call part leaved.
   * 
   * @param callId the call id
   * @param providerType the provider type
   * @param partId the part id
   * @param userId the user id
   */
  protected void fireUserCallLeaved(String callId, String providerType, String partId, String userId) {
    Set<UserCallListener> listeners = userListeners.get(userId);
    if (listeners != null) {
      for (UserCallListener listener : listeners) {
        if (listener.isListening()) {
          listener.onPartLeaved(callId, providerType, partId);
        }
      }
    }
  }

  /**
   * Adds the plugin.
   *
   * @param plugin the plugin
   */
  public void addPlugin(ComponentPlugin plugin) {
    Class<VideoCallsProvider> pclass = VideoCallsProvider.class;
    if (pclass.isAssignableFrom(plugin.getClass())) {
      addProvider(pclass.cast(plugin));
    } else {
      LOG.warn("Video Calls provider plugin is not an instance of " + pclass.getName() + ". Skipped plugin: "
          + plugin);
    }
  }

  /**
   * Adds the provider.
   *
   * @param provider the provider
   */
  public void addProvider(VideoCallsProvider provider) {
    for (String type : provider.getSupportedTypes()) {
      VideoCallsProvider existing = providers.putIfAbsent(type, provider);
      if (existing != null) {
        LOG.warn("Video Calls provider type '" + existing.getType() + "' already registered. Skipped plugin: "
            + provider);
      }
    }
  }

  /**
   * Gets the provider.
   *
   * @param type the type
   * @return the provider
   */
  public VideoCallsProvider getProvider(String type) {
    return providers.get(type);
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public void start() {
    // XXX SpaceService done in crappy way and we need reference it after the container start only, otherwise
    // it will fail the whole server start due to not found JCR service
    this.spaceService = ExoContainerContext.getCurrentContainer()
                                           .getComponentInstanceOfType(SpaceService.class);
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public void stop() {
    // nothing
  }

  /**
   * Checks if is space member.
   *
   * @param userName the user name
   * @param spacePrettyName the space pretty name
   * @return true, if is space member
   */
  protected boolean isSpaceMember(String userName, String spacePrettyName) {
    return getSpaceMembers(spacePrettyName).contains(userName);
  }

  /**
   * Gets the space members.
   *
   * @param spacePrettyName the space pretty name
   * @return the space members
   */
  protected Set<String> getSpaceMembers(String spacePrettyName) {
    Space space = spaceService.getSpaceByPrettyName(spacePrettyName);
    Set<String> spaceMembers = new HashSet<String>();
    for (String sm : space.getMembers()) {
      spaceMembers.add(sm);
    }
    return spaceMembers;
  }

  /**
   * Call to JSON.
   *
   * @param call the call
   * @return the JSON object
   * @throws JSONException the JSON exception
   */
  protected JSONObject callToJSON(CallInfo call) throws JSONException {
    // We follow a minimal data required to restore the persisted call

    JSONObject json = new JSONObject();
    json.put("id", call.getId());
    json.put("title", call.getTitle());
    json.put("avatarLink", call.getAvatarLink());
    json.put("ownerType", call.getOwnerType());
    json.put("ownerLink", call.getOwnerLink());
    json.put("providerType", call.getProviderType());
    if (call.getState() != null) {
      json.put("state", call.getState());
    }

    // Owner
    JSONObject jsonOwner = new JSONObject();
    jsonOwner.put("id", call.getOwner().getId());
    String ownerType = call.getOwner().getType();
    jsonOwner.put("type", ownerType);
    if (OWNER_TYPE_CHATROOM.equals(ownerType)) {
      RoomInfo room = (RoomInfo) call.getOwner();
      jsonOwner.put("name", room.getName());
      jsonOwner.put("title", room.getTitle());
      // XXX room/space members not interesting in this context
    }
    json.put("owner", jsonOwner);

    // Participants
    JSONArray jsonParts = new JSONArray();
    for (UserInfo p : call.getParticipants()) {
      JSONObject jsonPart = new JSONObject();
      jsonPart.put("id", p.getId());
      jsonPart.put("type", p.getType());
      String state = p.getState();
      if (state != null) {
        jsonPart.put("state", state);
      }
      jsonParts.put(jsonPart);
    }
    json.put("participants", jsonParts);

    return json;
  }

  /**
   * Json to call.
   *
   * @param json the json
   * @return the call info
   * @throws Exception the exception
   */
  protected CallInfo jsonToCall(JSONObject json) throws Exception {
    String id = json.getString("id");
    String title = json.getString("title");
    String avatarLink = json.getString("avatarLink");
    String ownerType = json.getString("ownerType");
    String ownerLink = json.getString("ownerLink");
    String providerType = json.getString("providerType");
    String state = json.optString("state", null);

    // Owner
    JSONObject jsonOwner = json.getJSONObject("owner");
    String ownerId = jsonOwner.getString("id");
    IdentityInfo owner;
    if (OWNER_TYPE_CHATROOM.equals(ownerType)) {
      // XXX room/space members not interesting in this context
      owner = roomInfo(ownerId, jsonOwner.getString("name"), jsonOwner.getString("title"), new String[0], id);
    } else if (OWNER_TYPE_SPACE.equals(ownerType)) {
      owner = getSpaceInfo(ownerId);
    } else if (UserInfo.TYPE_NAME.equals(ownerType)) {
      owner = getUserInfo(ownerId);
    } else {
      LOG.error("Unexpected call owner, type: " + ownerType + ", id: " + ownerId);
      throw new CallInfoException("Unexpected call owner: " + ownerId);
    }

    CallInfo call = new CallInfo(id, title, owner, ownerType, ownerLink, avatarLink, providerType);
    if (state != null) {
      call.setState(state);
    }
    // Participants
    JSONArray jsonParts = json.getJSONArray("participants");
    for (int i = 0; i < jsonParts.length(); i++) {
      JSONObject jsonPart = jsonParts.getJSONObject(i);
      String partId = jsonPart.getString("id");
      String partType = jsonPart.getString("type");
      if (UserInfo.TYPE_NAME.equals(partType)) {
        UserInfo user = getUserInfo(partId);
        if (user != null) {
          String partState = jsonPart.optString("state", null);
          if (partState != null) {
            user.setState(partState);
          }
          call.addParticipant(user);
        } else {
          LOG.warn("Cannot add call participant as eXo user: " + partId);
          call.addParticipant(new ParticipantInfo(providerType, partId));
        }
      } else {
        call.addParticipant(new ParticipantInfo(providerType, partId));
      }
    }

    return call;
  }

  /**
   * Save call.
   *
   * @param call the call
   * @throws Exception the exception
   */
  protected void saveCall(CallInfo call) throws Exception {
    saveOwnerCallId(call.getOwner().getId(), call.getId());
    final String initialGlobalId = Scope.GLOBAL.getId();
    try {
      JSONObject json = callToJSON(call);
      String safeCallId = URLEncoder.encode(call.getId(), "UTF-8");
      settingService.set(Context.GLOBAL,
                         Scope.GLOBAL.id(CALL_ID_SCOPE_NAME),
                         safeCallId,
                         SettingValue.create(json.toString()));
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  /**
   * Read call by owner id.
   *
   * @param ownerId the owner id
   * @return the call info
   * @throws Exception the exception
   */
  protected CallInfo readCallByOwnerId(String ownerId) throws Exception {
    String callId = readOwnerCallId(ownerId);
    if (callId != null) {
      return readCallById(callId);
    } else {
      return null;
    }
  }

  /**
   * Read call by id.
   *
   * @param id the id
   * @return the call info
   * @throws Exception the exception
   */
  protected CallInfo readCallById(String id) throws Exception {
    final String initialGlobalId = Scope.GLOBAL.getId();
    try {
      String safeCallId = URLEncoder.encode(id, "UTF-8");
      SettingValue<?> val =
                          settingService.get(Context.GLOBAL, Scope.GLOBAL.id(CALL_ID_SCOPE_NAME), safeCallId);
      if (val != null) {
        String str = String.valueOf(val.getValue());
        if (str.startsWith("{")) {
          // Assuming it's JSON
          CallInfo call = jsonToCall(new JSONObject(str));
          return call;
        } else {
          LOG.warn("Cannot parse saved CallInfo: " + str);
        }
      }
      return null;
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  /**
   * Delete call.
   *
   * @param call the call
   * @throws Exception the exception
   */
  protected void deleteCall(CallInfo call) throws Exception {
    final String initialGlobalId = Scope.GLOBAL.getId();
    try {
      String safeCallId = URLEncoder.encode(call.getId(), "UTF-8");
      settingService.remove(Context.GLOBAL, Scope.GLOBAL.id(CALL_ID_SCOPE_NAME), safeCallId);
      settingService.remove(Context.GLOBAL, Scope.GLOBAL.id(CALL_OWNER_SCOPE_NAME), call.getOwner().getId());
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  /**
   * Delete call by id.
   *
   * @param id the id
   * @return the call info
   * @throws Exception the exception
   */
  protected CallInfo deleteCallById(String id) throws Exception {
    CallInfo call = readCallById(id);
    if (call != null) {
      deleteCall(call);
    }
    return call;
  }

  /**
   * Save owner call id.
   *
   * @param ownerId the owner id
   * @param callId the call id
   */
  protected void saveOwnerCallId(String ownerId, String callId) {
    final String initialGlobalId = Scope.GLOBAL.getId();
    try {
      settingService.set(Context.GLOBAL,
                         Scope.GLOBAL.id(CALL_OWNER_SCOPE_NAME),
                         ownerId,
                         SettingValue.create(callId));
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  /**
   * Read owner call id.
   *
   * @param ownerId the owner id
   * @return the string
   */
  protected String readOwnerCallId(String ownerId) {
    final String initialGlobalId = Scope.GLOBAL.getId();
    try {
      SettingValue<?> val =
                          settingService.get(Context.GLOBAL, Scope.GLOBAL.id(CALL_OWNER_SCOPE_NAME), ownerId);
      if (val != null) {
        return String.valueOf(val.getValue());
      }
      return null;
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  /**
   * Delete owner call id.
   *
   * @param ownerId the owner id
   */
  protected void deleteOwnerCallId(String ownerId) {
    final String initialGlobalId = Scope.GLOBAL.getId();
    try {
      settingService.remove(Context.GLOBAL, Scope.GLOBAL.id(CALL_OWNER_SCOPE_NAME), ownerId);
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  /**
   * Read user group call ids.
   *
   * @param userId the user id
   * @return the string[]
   */
  protected String[] readUserGroupCallIds(String userId) {
    final String initialScopeId = Scope.GLOBAL.getId();
    final String initialContextId = Context.USER.getId();
    final Context userContext = userId != null ? Context.USER.id(userId) : Context.USER;
    final Scope userScope = Scope.GLOBAL.id(USER_CALLS_SCOPE_NAME);
    try {
      SettingValue<?> val = settingService.get(userContext, userScope, GROUP_CALL_TYPE);
      if (val != null) {
        return String.valueOf(val.getValue()).split("\n");
      }
      return null;
    } finally {
      Scope.GLOBAL.id(initialScopeId);
      Context.USER.id(initialContextId);
    }
  }

  /**
   * Save user group call id.
   *
   * @param userId the user id
   * @param callId the call id
   */
  protected void saveUserGroupCallId(String userId, String callId) {
    final String initialContextId = Context.USER.getId();
    final String initialScopeId = Scope.GLOBAL.getId();
    final Context userContext = userId != null ? Context.USER.id(userId) : Context.USER;
    final Scope userScope = Scope.GLOBAL.id(USER_CALLS_SCOPE_NAME);
    try {
      StringBuilder newVal = new StringBuilder();
      SettingValue<?> val = settingService.get(userContext, userScope, GROUP_CALL_TYPE);
      if (val != null) {
        String oldVal = String.valueOf(val.getValue());
        // XXX it may happen that user will list already deleted call IDs (if client failed to call delete but
        // started
        if (oldVal.indexOf(callId) >= 0) {
          return; // already contains this call ID
        } else {
          newVal.append(oldVal);
          newVal.append('\n');
        }
      }
      newVal.append(callId);
      settingService.set(userContext, userScope, GROUP_CALL_TYPE, SettingValue.create(newVal.toString()));
    } finally {
      Scope.GLOBAL.id(initialScopeId);
      Context.USER.id(initialContextId);
    }
  }

  /**
   * Removes the user group call id.
   *
   * @param userId the user id
   * @param callId the call id
   */
  protected void removeUserGroupCallId(String userId, String callId) {
    final String initialContextId = Context.USER.getId();
    final String initialScopeId = Scope.GLOBAL.getId();
    final Context userContext = userId != null ? Context.USER.id(userId) : Context.USER;
    final Scope userScope = Scope.GLOBAL.id(USER_CALLS_SCOPE_NAME);
    try {
      SettingValue<?> val = settingService.get(userContext, userScope, GROUP_CALL_TYPE);
      if (val != null) {
        String oldVal = String.valueOf(val.getValue());
        int start = oldVal.indexOf(callId);
        if (start >= 0) {
          StringBuilder newVal = new StringBuilder(oldVal);
          newVal.delete(start, start + callId.length() + 1); // also delete a \n as separator
          settingService.set(userContext, userScope, GROUP_CALL_TYPE, SettingValue.create(newVal.toString()));
        }
      }
    } finally {
      Scope.GLOBAL.id(initialScopeId);
      Context.USER.id(initialContextId);
    }
  }

  /**
   * Room info.
   *
   * @param id the id
   * @param name the name
   * @param title the title
   * @param members the members
   * @param callId the call id
   * @return the room info
   * @throws Exception the exception
   */
  protected RoomInfo roomInfo(String id,
                              String name,
                              String title,
                              String[] members,
                              String callId) throws Exception {
    RoomInfo room = new RoomInfo(id, name, title);
    for (String userName : members) {
      UserInfo user = getUserInfo(userName);
      if (user != null) {
        room.addMember(user);
      } else {
        if (LOG.isDebugEnabled()) {
          LOG.debug("Skipped not found user: " + userName);
        }
        throw new IdentityNotFound("User " + userName + " not found or not accessible");
      }
    }
    room.setCallId(callId);
    return room;
  };

  /**
   * Current user id.
   *
   * @return the string
   */
  protected String currentUserId() {
    ConversationState contextState = ConversationState.getCurrent();
    if (contextState != null) {
      return contextState.getIdentity().getUserId();
    }
    return null; // IdentityConstants.ANONIM
  }

  /**
   * Notify user call state.
   *
   * @param call the call
   * @param initiatorId the initiator id
   * @param state the state
   */
  protected void notifyUserCallState(CallInfo call, String initiatorId, String state) {
    for (UserInfo part : call.getParticipants()) {
      if (part.getType() == UserInfo.TYPE_NAME) {
        if (initiatorId == null || !initiatorId.equals(part.getId())) {
          fireUserCallState(part.getId(),
                            call.getId(),
                            call.getProviderType(),
                            state,
                            call.getOwner().getId(),
                            call.getOwner().getType());
        }
      }
    }
  }
}
