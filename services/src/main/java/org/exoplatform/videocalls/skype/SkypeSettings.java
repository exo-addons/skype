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
package org.exoplatform.videocalls.skype;

/**
 * Created by The eXo Platform SAS.
 *
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeSettings.java 00000 Mar 30, 2017 pnedonosko $
 */
public class SkypeSettings {

  /** The name. */
  protected final String   type;

  /** The supported types. */
  protected final String[] supportedTypes;

  /** The title. */
  protected final String   title;

  /** The call title. */
  protected final String   callTitle;

  /** The client id. */
  protected final String   clientId;

  /** The redirect uri. */
  protected final String   redirectUri;

  /** The version. */
  protected final String   version;

  /** The api key. */
  protected final String   apiKey;

  /** The api key CC. */
  protected final String   apiKeyCC;

  /** The origins. */
  protected final String[] origins;

  /**
   * Instantiates a new skype settings.
   *
   * @param type the name
   * @param supportedTypes the supported types
   * @param title the title
   * @param callTitle the call title
   * @param clientId the client id
   * @param redirectUri the redirect uri
   * @param version the version
   * @param apiKey the api key
   * @param apiKeyCC the api key CC
   * @param origins the origins
   */
  public SkypeSettings(String type,
                       String[] supportedTypes,
                       String title,
                       String callTitle,
                       String clientId,
                       String redirectUri,
                       String version,
                       String apiKey,
                       String apiKeyCC,
                       String[] origins) {
    super();
    this.type = type;
    this.supportedTypes = supportedTypes;
    this.title = title;
    this.callTitle = callTitle;
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.version = version;
    this.apiKey = apiKey;
    this.apiKeyCC = apiKeyCC;
    this.origins = origins;
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
   * Gets the client id.
   *
   * @return the client id
   */
  public String getClientId() {
    return clientId;
  }

  /**
   * Gets the redirect uri.
   *
   * @return the redirect uri
   */
  public String getRedirectUri() {
    return redirectUri;
  }

  /**
   * Gets the version.
   *
   * @return the version
   */
  public String getVersion() {
    return version;
  }

  /**
   * Gets the api key.
   *
   * @return the api key
   */
  public String getApiKey() {
    return apiKey;
  }

  /**
   * Gets the api key CC.
   *
   * @return the api key CC
   */
  public String getApiKeyCC() {
    return apiKeyCC;
  }

  /**
   * Gets the origins.
   *
   * @return the origins
   */
  public String[] getOrigins() {
    return origins;
  }

}
