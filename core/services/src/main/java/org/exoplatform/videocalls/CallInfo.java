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
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: CallInfo.java 00000 Jun 19, 2017 pnedonosko $
 * 
 */
public class CallInfo {

  protected final String        id;

  protected final String        title;

  protected final Set<UserInfo> participants = new LinkedHashSet<>();

  protected final IdentityInfo  owner;

  protected final String        ownerType;

  protected final String        ownerLink;

  protected final String        avatarLink;

  protected final String        providerType;

  public CallInfo(String id,
                  String title,
                  IdentityInfo owner,
                  String ownerType,
                  String ownerLink,
                  String avatarLink,
                  String providerType) {
    super();
    this.id = id;
    this.title = title;
    this.owner = owner;
    this.ownerType = ownerType;
    this.ownerLink = ownerLink;
    this.avatarLink = avatarLink;
    this.providerType = providerType;
  }

  public String getId() {
    return id;
  }

  public String getTitle() {
    return title;
  }

  public Set<UserInfo> getParticipants() {
    return participants;
  }

  public IdentityInfo getOwner() {
    return owner;
  }

  public String getOwnerType() {
    return ownerType;
  }

  public String getOwnerLink() {
    return ownerLink;
  }

  public String getAvatarLink() {
    return avatarLink;
  }

  public String getProviderType() {
    return providerType;
  }

  public void addParticipants(Collection<UserInfo> parts) {
    this.participants.addAll(parts);
  }

  public void addParticipant(UserInfo part) {
    this.participants.add(part);
  }

}
