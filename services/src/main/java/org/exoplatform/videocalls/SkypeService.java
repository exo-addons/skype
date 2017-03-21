
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

import org.exoplatform.container.ExoContainerContext;
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
import org.exoplatform.videocalls.UserInfo.IMInfo;
import org.picocontainer.Startable;

import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeService.java 00000 Feb 22, 2017 pnedonosko $
 * 
 */
@Deprecated
public class SkypeService implements Startable {

  public static final String    SKYPE_SCHEMA = "skype";

  public static final String    SFB_SCHEMA   = "ms-sfb";

  protected static final String EMAIL_REGEX  =
                                            "^(?=[A-Z0-9][A-Z0-9@._%+-]{5,253}+$)[A-Z0-9._%+-]{1,64}+@(?:(?=[A-Z0-9-]{1,63}+\\.)[A-Z0-9]++(?:-[A-Z0-9]++)*+\\.){1,8}+[A-Z]{2,63}+$";

  /**
   * The Class SkypeIMInfo.
   */
  public class SkypeIMInfo extends IMInfo {

    /**
     * Instantiates a new skype IM info.
     *
     * @param id the id
     */
    protected SkypeIMInfo(String id) {
      super(SKYPE_SCHEMA, id);
    }

    /**
     * Checks if is business.
     *
     * @return true, if is business
     */
    public boolean isBusiness() {
      return false;
    }
  }

  /**
   * The Class SkypeBusinessIMInfo.
   */
  public class SkypeBusinessIMInfo extends IMInfo {

    /**
     * Instantiates a new skype business IM info.
     *
     * @param type the type
     * @param id the id
     */
    protected SkypeBusinessIMInfo(String id) {
      super(SFB_SCHEMA, id);
    }

    /**
     * Checks if is business.
     *
     * @return true, if is business
     */
    public boolean isBusiness() {
      return true;
    }
  }

  /**
   * The Class SpaceInfo.
   */
  public class SpaceInfo extends GroupInfo {

    protected final String shortName;

    protected final String prettyName;
    
    protected final Map<String, UserInfo> members = new LinkedHashMap<>();

    /**
     * Instantiates a new space info.
     *
     * @param socialSpace the social space
     */
    public SpaceInfo(Space socialSpace) {
      super(socialSpace.getGroupId(), socialSpace.getDisplayName());
      this.shortName = socialSpace.getShortName();
      this.prettyName = socialSpace.getPrettyName();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Map<String, UserInfo> getMembers() {
      return Collections.unmodifiableMap(members);
    }

    protected void addMember(UserInfo user) {
      members.put(user.getName(), user);
    }
    
    /**
     * @return the shortName
     */
    public String getShortName() {
      return shortName;
    }

    /**
     * @return the prettyName
     */
    public String getPrettyName() {
      return prettyName;
    }
  }

  protected static final Log             LOG       = ExoLogger.getLogger(SkypeService.class);

  /** The jcr service. */
  protected final RepositoryService      jcrService;

  /** The session providers. */
  protected final SessionProviderService sessionProviders;

  /** The hierarchy creator. */
  protected final NodeHierarchyCreator   hierarchyCreator;

  /** The organization. */
  protected final OrganizationService    organization;

  /** The social identity manager. */
  protected final IdentityManager        socialIdentityManager;

  /** The drive service. */
  protected final ManageDriveService     driveService;

  /** The listener service. */
  protected final ListenerService        listenerService;

  protected final Pattern                emailTest = Pattern.compile(EMAIL_REGEX, Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

  protected SpaceService                 spaceService;

  /**
   * Instantiates a new Skype service.
   *
   * @param jcrService the jcr service
   * @param sessionProviders the session providers
   * @param hierarchyCreator the hierarchy creator
   * @param organization the organization
   * @param socialIdentityManager the social identity manager
   * @param driveService the drive service
   * @param listenerService the listener service
   */
  public SkypeService(RepositoryService jcrService,
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
    Identity userIdentity = socialIdentityManager.getOrCreateIdentity(OrganizationIdentityProvider.NAME, id, true);
    if (user != null && userIdentity != null) {
      Profile socialProfile = socialIdentityManager.getProfile(userIdentity);
      @SuppressWarnings("unchecked")
      List<Map<String, String>> ims = (List<Map<String, String>>) socialProfile.getProperty(Profile.CONTACT_IMS);
      UserInfo info = new UserInfo(user.getUserName(), user.getFirstName(), user.getLastName());
      if (ims != null) {
        for (Map<String, String> m : ims) {
          String imType = m.get("key");
          String imId = m.get("value");
          if (imId != null && imId.length() > 0) {
            if (SKYPE_SCHEMA.equals(imType)) {
              if (emailTest.matcher(imId).find()) { // imId.indexOf('@') > 0
                // TODO it looks as email, assume it's SfB account
                info.addImAccount(new SkypeBusinessIMInfo(imId));
              } else {
                info.addImAccount(new SkypeIMInfo(imId));
              }
            } else if (SFB_SCHEMA.equals(imType)) {
              info.addImAccount(new SkypeBusinessIMInfo(imId));
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
   * {@inheritDoc}
   */
  @Override
  public void start() {
    // XXX SpaceService done in crappy way and we need reference it after the container start only, otherwise
    // it will fail the whole server start due to not found JCR service
    this.spaceService = ExoContainerContext.getCurrentContainer().getComponentInstanceOfType(SpaceService.class);
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public void stop() {
    // nothing
  }

  protected boolean isSpaceMember(String userName, String spacePrettyName) {
    return getSpaceMembers(spacePrettyName).contains(userName);
  }

  protected Set<String> getSpaceMembers(String spacePrettyName) {
    Space space = spaceService.getSpaceByPrettyName(spacePrettyName);
    Set<String> spaceMembers = new HashSet<String>();
    for (String sm : space.getMembers()) {
      spaceMembers.add(sm);
    }
    return spaceMembers;
  }
  
}
