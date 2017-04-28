
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

import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

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
import org.exoplatform.social.core.identity.model.Identity;
import org.exoplatform.social.core.identity.model.Profile;
import org.exoplatform.social.core.identity.provider.OrganizationIdentityProvider;
import org.exoplatform.social.core.manager.IdentityManager;
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

  /**
   * The Class SpaceInfo.
   */
  public class SpaceInfo extends GroupInfo {

    /** The space pretty name. */
    protected final String                prettyName;

    /** The members. */
    protected final Map<String, UserInfo> members = new LinkedHashMap<>();

    /**
     * Instantiates a new space info.
     *
     * @param socialSpace the social space
     */
    public SpaceInfo(Space socialSpace) {
      super(socialSpace.getGroupId(), socialSpace.getDisplayName());
      this.prettyName = socialSpace.getPrettyName();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Map<String, UserInfo> getMembers() {
      return Collections.unmodifiableMap(members);
    }

    /**
     * Adds the member.
     *
     * @param user the user
     */
    protected void addMember(UserInfo user) {
      members.put(user.getName(), user);
    }

    /**
     * Gets the pretty name.
     *
     * @return the prettyName
     */
    public String getPrettyName() {
      return prettyName;
    }
  }

  /** The Constant LOG. */
  protected static final Log                      LOG       = ExoLogger.getLogger(VideoCallsService.class);

  /** The jcr service. */
  protected final RepositoryService               jcrService;

  /** The session providers. */
  protected final SessionProviderService          sessionProviders;

  /** The hierarchy creator. */
  protected final NodeHierarchyCreator            hierarchyCreator;

  /** The organization. */
  protected final OrganizationService             organization;

  /** The social identity manager. */
  protected final IdentityManager                 socialIdentityManager;

  /** The drive service. */
  protected final ManageDriveService              driveService;

  /** The listener service. */
  protected final ListenerService                 listenerService;

  /** The providers. */
  protected final Map<String, VideoCallsProvider> providers = new ConcurrentHashMap<>();

  /** The space service. */
  protected SpaceService                          spaceService;

  /**
   * Instantiates a new VideoCalls service.
   *
   * @param jcrService the jcr service
   * @param sessionProviders the session providers
   * @param hierarchyCreator the hierarchy creator
   * @param organization the organization
   * @param socialIdentityManager the social identity manager
   * @param driveService the drive service
   * @param listenerService the listener service
   */
  public VideoCallsService(RepositoryService jcrService,
                           SessionProviderService sessionProviders,
                           NodeHierarchyCreator hierarchyCreator,
                           OrganizationService organization,
                           IdentityManager socialIdentityManager,
                           ManageDriveService driveService,
                           ListenerService listenerService) {
    this.jcrService = jcrService;
    this.sessionProviders = sessionProviders;
    this.hierarchyCreator = hierarchyCreator;
    this.organization = organization;
    this.socialIdentityManager = socialIdentityManager;
    this.driveService = driveService;
    this.listenerService = listenerService;
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
    if (user != null && userIdentity != null) {
      Profile socialProfile = socialIdentityManager.getProfile(userIdentity);
      @SuppressWarnings("unchecked")
      List<Map<String, String>> ims =
                                    (List<Map<String, String>>) socialProfile.getProperty(Profile.CONTACT_IMS);
      UserInfo info = new UserInfo(user.getUserName(), user.getFirstName(), user.getLastName());
      if (ims != null) {
        for (Map<String, String> m : ims) {
          // TODO constants key/value - use from Social Profile code
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
      return info;
    } else {
      return null;
    }
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
      space.addMember(user);
    }
    return space;
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

}
