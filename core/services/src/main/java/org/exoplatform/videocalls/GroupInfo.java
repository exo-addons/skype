
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
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Group abstraction for conversations in eXo video calls.<br>
 * 
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: GroupInfo.java 00000 Mar 3, 2017 pnedonosko $
 * 
 */
public abstract class GroupInfo extends IdentityInfo {

  /** The group call id. */
  protected String                      callId;

  /** The members. */
  protected final Map<String, UserInfo> members = new LinkedHashMap<>();

  /**
   * Instantiates a new group info.
   *
   * @param id the id
   * @param title the title
   */
  public GroupInfo(String id, String title) {
    super(id, title);
  }

  /**
   * Gets the call id.
   *
   * @return the call id
   */
  public String getCallId() {
    return callId;
  }


  /**
   * {@inheritDoc}
   */
  public boolean isGroup() {
    return true;
  }

  /**
   * Sets the call id.
   *
   * @param callId the new call id
   */
  protected void setCallId(String callId) {
    this.callId = callId;
  }

  /**
   * Gets the members.
   *
   * @return the members
   */
  public Map<String, UserInfo> getMembers() {
    return Collections.unmodifiableMap(members);
  }

  /**
   * Adds the member.
   *
   * @param user the user
   */
  protected void addMember(UserInfo user) {
    members.put(user.getId(), user);
  }
  
  /**
   * Adds the members (bulk operation).
   *
   * @param users the users
   */
  protected void addMembers(Collection<UserInfo> users) {
    for (UserInfo u : users) {
      addMember(u);      
    }
  }

}
