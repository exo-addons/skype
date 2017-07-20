
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

import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
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
import org.exoplatform.services.security.IdentityConstants;
import org.exoplatform.social.core.identity.model.Identity;
import org.exoplatform.social.core.identity.model.Profile;
import org.exoplatform.social.core.identity.provider.OrganizationIdentityProvider;
import org.exoplatform.social.core.manager.IdentityManager;
import org.exoplatform.social.core.service.LinkProvider;
import org.exoplatform.social.core.space.model.Space;
import org.exoplatform.social.core.space.spi.SpaceService;
import org.picocontainer.Startable;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeService.java 00000 Feb 22, 2017 pnedonosko $
 */
public class VideoCallsService implements Startable {

  public static final String    SPACE_TYPE_NAME       = "space".intern();

  public static final String    CHAT_ROOM_TYPE_NAME   = "chat_room".intern();

  protected static final String GROUP_CALL_TYPE       = "group".intern();

  protected static final String CALL_OWNER_SCOPE_NAME = "videocalls.callOwner".intern();

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

  public static final String                             OWNER_TYPE_USER     = "user";

  public static final String                             OWNER_TYPE_SPACE    = "space";

  public static final String                             OWNER_TYPE_CHATROOM = "chat_room";

  /** The Constant LOG. */
  protected static final Log                             LOG                 =
                                                             ExoLogger.getLogger(VideoCallsService.class);

  /** The jcr service. */
  protected final RepositoryService                      jcrService;

  /** The session providers. */
  protected final SessionProviderService                 sessionProviders;

  /** The hierarchy owner. */
  protected final NodeHierarchyCreator                   hierarchyCreator;

  /** The organization. */
  protected final OrganizationService                    organization;

  /** The social identity manager. */
  protected final IdentityManager                        socialIdentityManager;

  /** The drive service. */
  protected final ManageDriveService                     driveService;

  /** The listener service. */
  protected final ListenerService                        listenerService;

  /** The settings service. */
  protected final SettingService                         settingService;

  /** The providers. */
  protected final Map<String, VideoCallsProvider>        providers           = new ConcurrentHashMap<>();

  /** The space service. */
  protected SpaceService                                 spaceService;

  /** The active calls. */
  protected final Map<String, CallInfo>                  calls               = new ConcurrentHashMap<>();

  /** The user listeners. */
  protected final Map<String, Set<IncomingCallListener>> userListeners       = new ConcurrentHashMap<>();

  /** The group calls. */
  // protected final Map<String, String> groupCalls = new ConcurrentHashMap<>();

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
              VideoCallsProvider provider = providers.get(imType);
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
    space.setCallId(readCallId(spacePrettyName)); // groupCalls.get(spacePrettyName)
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
    room.setCallId(readCallId(id));
    return room;
  };

  /**
   * Adds the call info.
   *
   * @param id the id
   * @param ownerId the owner id
   * @param title the title
   * @param providerType the provider type
   * @param parts the parts
   * @return the call info
   * @throws Exception the exception
   */
  public CallInfo addCallInfo(String id,
                              String ownerId,
                              String ownerType,
                              String title,
                              String providerType,
                              Collection<String> parts) throws Exception {
    boolean isUser = OWNER_TYPE_USER.equals(ownerType);
    boolean isSpace = OWNER_TYPE_SPACE.equals(ownerType);
    boolean isRoom = OWNER_TYPE_CHATROOM.equals(ownerType);
    String ownerUri, ownerAvatar;
    IdentityInfo owner;
    if (isUser) {
      UserInfo userInfo = getUserInfo(ownerId);
      if (userInfo == null) {
        // if owner user not found, it's possibly an external user, thus treat it as a chat room
        owner = new RoomInfo(ownerId, ownerId, title);
        ownerUri = ParticipantInfo.EMPTY_NAME;
        ownerAvatar = LinkProvider.PROFILE_DEFAULT_AVATAR_URL;
      } else {
        owner = userInfo;
        ownerUri = userInfo.getProfileUri();
        ownerAvatar = userInfo.getAvatarUri();
        if (ownerAvatar == null) {
          ownerAvatar = LinkProvider.PROFILE_DEFAULT_AVATAR_URL;
        }
      }
    } else if (isSpace) {
      Space space = spaceService.getSpaceByPrettyName(ownerId);
      if (space != null) {
        owner = new SpaceInfo(space);
        ownerUri = space.getUrl();
        ownerAvatar = space.getAvatarUrl();
        if (ownerAvatar == null) {
          ownerAvatar = LinkProvider.SPACE_DEFAULT_AVATAR_URL;
        }
      } else {
        LOG.warn("Cannot find call's owner space " + ownerId);
        owner = new RoomInfo(ownerId, ownerId, title);
        ownerUri = ParticipantInfo.EMPTY_NAME;
        ownerAvatar = LinkProvider.SPACE_DEFAULT_AVATAR_URL;
      }
    } else if (isRoom) {
      owner = new RoomInfo(ownerId, ownerId, title);
      ownerUri = ParticipantInfo.EMPTY_NAME;
      ownerAvatar = LinkProvider.SPACE_DEFAULT_AVATAR_URL;
    } else {
      throw new CallInfoException("Wrong call owner type: " + ownerType);
    }
    if (isSpace || isRoom) {
      saveCallId(ownerId, id);
      String userId = currentUserId();
      if (userId != null) {
        // For starter of a group call we also record this call in its group calls, 
        // other parties will register in dedicated requests (e.g. when joined)
        saveUserGroupCallId(userId, id);
      } else {
        LOG.warn("Current user not set, but call registered " + id);
      }
    }
    CallInfo call = new CallInfo(providerType, title, owner, ownerType, ownerUri, ownerAvatar);
    for (String pid : parts) {
      UserInfo part = getUserInfo(pid);
      if (part != null) {
        // it's eXo user
        call.addParticipant(part);
        // fire user listener for incoming, except of the caller
        fireUserCallState(pid, id, CallState.STARTED);
      } else {
        // external participant
        call.addParticipant(new ParticipantInfo(providerType, pid));
      }
    }
    calls.put(id, call);
    return call;
  }

  /**
   * Gets the call info.
   *
   * @param id the id
   * @return the call info
   * @throws Exception the exception
   */
  public CallInfo getCallInfo(String id) throws Exception {
    return calls.get(id);
  }

  /**
   * Removes the call info.
   *
   * @param id the id
   * @return the call info
   * @throws Exception the exception
   */
  public CallInfo removeCallInfo(String id) throws Exception {
    CallInfo info = calls.remove(id);
    if (info != null) {
      for (UserInfo user : info.getParticipants()) {
        if (user.getType() == UserInfo.TYPE_NAME) {
          // it's eXo user: fire user listener for stopped call
          fireUserCallState(user.getId(), id, CallState.STOPPED);
        }
      }
    }
    return info;
  }

  /**
   * Adds the user call.
   *
   * @param userId the user id
   * @param callId the call id
   */
  public void addUserCall(String userId, String callId) {
    // add to user's list of saved calls (group calls)
    saveUserGroupCallId(null, callId); // TODO use userId
  }

  /**
   * Removes the user call.
   *
   * @param callId the call id
   */
  public void removeUserCall(String userId, String callId) {
    removeUserGroupCallId(callId); // TODO use userId
    fireUserCallState(userId, callId, CallState.STOPPED);
  }

  /**
   * Gets the user calls.
   *
   * @param callId the call id
   * @return the user calls
   */
  public String[] getUserCalls(String userId) {
    String[] calls = readUserGroupCallIds(); // TODO use userId
    if (calls == null) {
      calls = new String[0];
    }
    return calls;
  }

  public void addUserListener(IncomingCallListener listener) {
    // incomingListener.onCall(callId, callStatus);
    final String userId = listener.getUserId();
    userListeners.computeIfAbsent(userId, k -> new LinkedHashSet<>()).add(listener);
  }

  protected void fireUserCallState(String userId, String callId, String callState) {
    Set<IncomingCallListener> listeners = userListeners.remove(userId);
    if (listeners != null) {
      for (IncomingCallListener listener : listeners) {
        listener.onCall(callId, callState);
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

  protected void saveCallId(String ownerId, String callId) {
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

  protected String readCallId(String ownerId) {
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

  protected String[] readUserGroupCallIds() {
    final String initialGlobalId = Scope.GLOBAL.getId();
    try {
      SettingValue<?> val = settingService.get(Context.USER,
                                               Scope.GLOBAL.id(USER_CALLS_SCOPE_NAME),
                                               GROUP_CALL_TYPE);
      if (val != null) {
        return String.valueOf(val.getValue()).split("\n");
      }
      return null;
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  protected void saveUserGroupCallId(String userId, String callId) {
    final String initialGlobalId = Scope.GLOBAL.getId();
    final Context userContext = Context.USER.id(userId);
    final Scope userScope = Scope.GLOBAL.id(USER_CALLS_SCOPE_NAME);
    try {
      StringBuilder newVal = new StringBuilder();
      SettingValue<?> val = settingService.get(userContext, userScope, GROUP_CALL_TYPE);
      if (val != null) {
        String oldVal = String.valueOf(val.getValue());
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
      Scope.GLOBAL.id(initialGlobalId);
    }
  }

  protected void removeUserGroupCallId(String callId) {
    final String initialGlobalId = Scope.GLOBAL.getId();
    final Scope userScope = Scope.GLOBAL.id(USER_CALLS_SCOPE_NAME);
    try {
      SettingValue<?> val = settingService.get(Context.USER, userScope, GROUP_CALL_TYPE);
      if (val != null) {
        String oldVal = String.valueOf(val.getValue());
        int start = oldVal.indexOf(callId);
        if (start >= 0) {
          StringBuilder newVal = new StringBuilder();
          newVal.delete(start, start + callId.length() + 1); // also delete a \n as separator
          settingService.set(Context.USER,
                             userScope,
                             GROUP_CALL_TYPE,
                             SettingValue.create(newVal.toString()));
        }
      }
    } finally {
      Scope.GLOBAL.id(initialGlobalId);
    }
  }
  
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

}
