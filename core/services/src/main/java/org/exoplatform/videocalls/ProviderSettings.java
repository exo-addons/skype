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
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: ProviderSettings.java 00000 Aug 15, 2017 pnedonosko $
 */
public class ProviderSettings {

  /** The name. */
  protected final String   type;

  /** The supported types. */
  protected final String[] supportedTypes;

  /** The title. */
  protected final String   title;

  /** The call title. */
  protected final String   callTitle;

  /** The join title. */
  protected final String   joinTitle;

  /** The version. */
  protected final String   version;

  /**
   * Instantiates a new settings.
   *
   * @param type the name
   * @param supportedTypes the supported types
   * @param title the title
   * @param callTitle the call title
   * @param joinTitle the join title
   * @param version the version
   */
  public ProviderSettings(String type,
                        String[] supportedTypes,
                        String title,
                        String callTitle,
                        String joinTitle,
                        String version) {
    super();
    this.type = type;
    this.supportedTypes = supportedTypes;
    this.title = title;
    this.callTitle = callTitle;
    this.joinTitle = joinTitle;
    this.version = version;
  }

  /**
   * Gets the name.
   *
   * @return the name
   */
  public String getType() {
    return type;
  }

  /**
   * Gets the supported types.
   *
   * @return the supported types
   */
  public String[] getSupportedTypes() {
    return supportedTypes;
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
   * Gets the call title.
   *
   * @return the call title
   */
  public String getCallTitle() {
    return callTitle;
  }

  /**
   * Gets the join title.
   *
   * @return the join title
   */
  public String getJoinTitle() {
    return joinTitle;
  }

  /**
   * Gets the version.
   *
   * @return the version
   */
  public String getVersion() {
    return version;
  }

}
