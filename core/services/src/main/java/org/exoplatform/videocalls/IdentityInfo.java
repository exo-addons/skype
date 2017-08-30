
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
 * Identity abstraction for conversations in eXo video calls.<br>
 * 
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: IdentityInfo.java 00000 Mar 3, 2017 pnedonosko $
 * 
 */
public abstract class IdentityInfo {
  
  /** The Constant ME. */
  public static final String        ME    = "me";

  /** The Constant EMPTY. */
  public static final String        EMPTY = "".intern();

  /** The title. */
  protected final String title;

  /** The id. */
  protected final String id;

  /**
   * Instantiates a new identity info.
   *
   * @param id the id
   * @param title the title
   */
  public IdentityInfo(String id, String title) {
    this.id = id;
    this.title = title;
  }

  /**
   * Gets the id.
   *
   * @return the id
   */
  public String getId() {
    return id;
  }

  /**
   * Gets the title.
   *
   * @return the title
   */
  public String getTitle() {
    return title;
  }

  /**
   * Checks if it is a group.
   *
   * @return true, if is a group
   */
  public abstract boolean isGroup();

  /**
   * Gets the identity type.
   *
   * @return the type
   */
  public abstract String getType();
  
}
