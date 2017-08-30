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

/**
 * A lightweight info about current Platform context: space, chat room etc.
 * 
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SpaceContextInfo.java 00000 Mar 30, 2017 pnedonosko $
 * 
 */
public class ContextInfo {

  /** The eXo container name. */
  private final String containerName;

  /** The space id (pretty name). */
  private final String spaceId;

  /** The room title. */
  private final String roomTitle;

  /** CometD server URL path. */
  private final String cometdPath;

  /** CometD server token. */
  private final String cometdToken;

  /**
   * Instantiates a new context info.
   *
   * @param containerName the container name
   * @param spaceId the space id
   * @param roomTitle the room name
   * @param cometdPath the cometd path
   * @param cometdToken the cometd token
   */
  public ContextInfo(String containerName,
                     String spaceId,
                     String roomTitle,
                     String cometdPath,
                     String cometdToken) {
    super();
    this.containerName = containerName;
    this.spaceId = spaceId;
    this.roomTitle = roomTitle;
    this.cometdPath = cometdPath;
    this.cometdToken = cometdToken;
  }

  /**
   * Instantiates a new context info.
   *
   * @param containerName the container name
   * @param spaceId the space id
   * @param roomTitle the room name
   */
  public ContextInfo(String containerName, String spaceId, String roomTitle) {
    this(containerName, spaceId, roomTitle, null, null);
  }

  /**
   * Gets the container name.
   *
   * @return the container name
   */
  public String getContainerName() {
    return containerName;
  }

  /**
   * Gets the cometd path (optional).
   *
   * @return the cometd path, can be <code>null</code>
   */
  public String getCometdPath() {
    return cometdPath;
  }

  /**
   * Gets the cometd token.
   *
   * @return the cometd token
   */
  public String getCometdToken() {
    return cometdToken;
  }

  /**
   * Gets the space id.
   *
   * @return the space id
   */
  public String getSpaceId() {
    return spaceId;
  }

  /**
   * Gets the room title.
   *
   * @return the room title
   */
  public String getRoomTitle() {
    return roomTitle;
  }

}
