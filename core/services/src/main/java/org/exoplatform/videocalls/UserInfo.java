
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

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.exoplatform.services.log.ExoLogger;
import org.exoplatform.services.log.Log;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: UserInfo.java 00000 Feb 23, 2017 pnedonosko $
 */
public class UserInfo extends IdentityInfo {

  /** The Constant LOG. */
  protected static final Log LOG = ExoLogger.getLogger(UserInfo.class);

  /**
   * The Class IMInfo.
   */
  public static class IMInfo {

    /** The type. */
    private final String type;

    /** The id. */
    private final String id;

    /**
     * Instantiates a new IM info.
     *
     * @param type the type
     * @param id the id
     */
    protected IMInfo(String type, String id) {
      super();
      this.type = type;
      this.id = id;
    }

    /**
     * Gets the type.
     *
     * @return the type
     */
    public String getType() {
      return type;
    }

    /**
     * Gets the id.
     *
     * @return the id
     */
    public String getId() {
      return id;
    }
  }

  /** The first name. */
  private final String                    firstName;

  /** The last name. */
  private final String                    lastName;

  /** The IM accounts. */
  private final Map<String, List<IMInfo>> imAccounts = new HashMap<String, List<IMInfo>>();
  
  /** The avatar uri. */
  private String                    avatarUri;
  
  /** The profile uri. */
  private String                    profileUri;

  /**
   * Instantiates a new user info.
   *
   * @param userId the user id in the system
   * @param firstName the first type
   * @param lastName the last type
   */
  public UserInfo(String userId, String firstName, String lastName) {
    super(userId, new StringBuffer(firstName).append(lastName).toString());
    this.firstName = firstName;
    this.lastName = lastName;
  }

  /**
   * Gets the first name.
   *
   * @return the firstName
   */
  public String getFirstName() {
    return firstName;
  }

  /**
   * Gets the last name.
   *
   * @return the lastName
   */
  public String getLastName() {
    return lastName;
  }

  /**
   * Gets the im accounts.
   *
   * @return the map of user instant messaging accounts: key is a type, value is a collection of
   *         {@link IMInfo}
   */
  public Map<String, Collection<IMInfo>> getImAccounts() {
    return Collections.unmodifiableMap(imAccounts);
  }

  /**
   * Adds the user IM account.
   *
   * @param type the IM type type (e.g. <code>gtalk</code>)
   * @param id the IM id
   * @return the added IM info
   */
  public IMInfo addImAccount(String type, String id) {
    IMInfo im = new IMInfo(type, id);
    imAccounts.computeIfAbsent(type, list -> new ArrayList<IMInfo>()).add(im);
    return im;
  }

  /**
   * Adds the user IM account(s). Note that if IM with some type already added an another one will be skipped.
   *
   * @param ims the IM account(s) to add to the user profile
   */
  public void addImAccount(IMInfo... ims) {
    for (IMInfo im : ims) {
      imAccounts.computeIfAbsent(im.getType(), list -> new ArrayList<IMInfo>()).add(im);
    }
  }

  /**
   * Checks for IM account associated with the user.
   *
   * @param type the IM account type
   * @return <code>true</code>, if successful
   */
  public boolean hasImAccount(String type) {
    return imAccounts.containsKey(type);
  }

  /**
   * Gets the IM accounts by type.
   *
   * @param type the type
   * @return the IM accounts
   */
  public Collection<IMInfo> getImAccount(String type) {
    return Collections.unmodifiableCollection(imAccounts.get(type));
  }

  public String getAvatarUri() {
    return avatarUri;
  }

  public void setAvatarUri(String avatarUri) {
    this.avatarUri = avatarUri;
  }

  public String getProfileUri() {
    return profileUri;
  }

  public void setProfileUri(String profileUri) {
    this.profileUri = profileUri;
  }
  
  
}
