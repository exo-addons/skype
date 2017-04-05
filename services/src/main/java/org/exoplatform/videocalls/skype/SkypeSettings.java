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
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeSettings.java 00000 Mar 30, 2017 pnedonosko $
 * 
 */
public class SkypeSettings {
  
  protected final String name;
  
  protected final String title;
  
  protected final String callTitle;
  
  protected final String clientId;
  
  protected final String redirectUri;
  
  protected final String version;

  protected final String apiKey;
  
  protected final String apiKeyCC;
  
  protected final String[] origins;

  /**
   * Instantiates a new skype settings.
   * 
   * {
    name : "${name}",
    title : "${title}",
    callTitle : "${callTitle}",
    clientId : "${clientId}",
    redirectUri : "${redirectUri}",
    origins : ["https://webdir.online.lync.com/autodiscover/autodiscoverservice.svc/root"],
    version : "${version}",
    apiKey : "${apiKey}",
    apiKeyCC : "${apiKeyCC}"
  };
   *
   * @param name the name
   * @param title the title
   * @param callTitle the call title
   * @param clientId the client id
   * @param redirectUri the redirect uri
   * @param version the version
   * @param apiKey the api key
   * @param apiKeyCC the api key CC
   * @param origins the origins
   */
  public SkypeSettings(String name,
                       String title,
                       String callTitle,
                       String clientId,
                       String redirectUri,
                       String version,
                       String apiKey,
                       String apiKeyCC,
                       String[] origins) {
    super();
    this.name = name;
    this.title = title;
    this.callTitle = callTitle;
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.version = version;
    this.apiKey = apiKey;
    this.apiKeyCC = apiKeyCC;
    this.origins = origins;
  }

  public String getName() {
    return name;
  }

  public String getTitle() {
    return title;
  }

  public String getCallTitle() {
    return callTitle;
  }

  public String getClientId() {
    return clientId;
  }

  public String getRedirectUri() {
    return redirectUri;
  }

  public String getVersion() {
    return version;
  }

  public String getApiKey() {
    return apiKey;
  }

  public String getApiKeyCC() {
    return apiKeyCC;
  }

  public String[] getOrigins() {
    return origins;
  }
  
}
