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

  /** The space pretty name. */
  private final String spaceName;

  /** The room name. */
  private final String roomName;

  /**
   * Instantiates a new context info.
   *
   * @param spaceName the space name
   * @param roomName the room name
   */
  public ContextInfo(String spaceName, String roomName) {
    super();
    this.spaceName = spaceName;
    this.roomName = roomName;
  }

  /**
   * Gets the space pretty name.
   *
   * @return the space name
   */
  public String getSpaceName() {
    return spaceName;
  }

  /**
   * Gets the room name.
   *
   * @return the room name
   */
  public String getRoomName() {
    return roomName;
  }

}
