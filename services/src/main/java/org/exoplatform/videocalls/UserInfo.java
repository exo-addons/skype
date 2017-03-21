
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
import java.util.HashMap;
import java.util.Map;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: UserInfo.java 00000 Feb 23, 2017 pnedonosko $
 */
public class UserInfo {

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
  
  /** The name. */
  private final String name;

  /** The first name. */
  private final String firstName;

  /** The last name. */
  private final String lastName;

  /** The ims. */
  private final Map<String, IMInfo> ims = new HashMap<String, IMInfo>();

  /**
   * Instantiates a new user info.
   *
   * @param userName the user id in the system
   * @param firstName the first type
   * @param lastName the last type
   */
  public UserInfo(String userName, String firstName, String lastName) {
    super();
    this.name = userName;
    this.firstName = firstName;
    this.lastName = lastName;
  }

  /**
   * Gets the name.
   *
   * @return the user id in the system
   */
  public String getName() {
    return name;
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
   * @return the map of user instant messaging accounts: key is a type, value is {@link IMInfo}
   */
  public Map<String, IMInfo> getImAccounts() {
    return Collections.unmodifiableMap(ims);
  }
  
  /**
   * Adds the user IM account.
   *
   * @param type the IM type type (e.g. <code>gtalk</code>)
   * @param id the IM id
   * @return the IM info
   */
  public IMInfo addImAccount(String type, String id) {
    IMInfo im = new IMInfo(type, id);
    ims.put(type, im);
    return im;
  }
  
  /**
   * Adds the user IM account instance.
   *
   * @param im the im
   */
  public void addImAccount(IMInfo im) {
    ims.put(im.getType(), im);
  }
  
  /**
   * Checks for IM account.
   *
   * @param type the type
   * @return true, if successful
   */
  public boolean hasImAccount(String type) {
    return ims.containsKey(type);
  }
  
  /**
   * Gets the IM account by type.
   *
   * @param type the type
   * @return the IM account
   */
  public IMInfo getImAccount(String type) {
    return ims.get(type);
  }
}
