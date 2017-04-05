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

import java.util.List;

import org.exoplatform.container.configuration.ConfigurationException;
import org.exoplatform.container.xml.InitParams;
import org.exoplatform.container.xml.ValuesParam;
import org.exoplatform.videocalls.UserInfo.IMInfo;
import org.exoplatform.videocalls.VideoCallsProviderException;

/**
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeProvider.java 00000 Mar 30, 2017 pnedonosko $
 * 
 */
public class SkypeBusinessProvider extends SkypeProvider {

  public static final String CONFIG_AUTODISCOVER_ORIGINS      = "autodiscover-origins";

  public static final String CONFIG_WEB_OAUTH2_URL            = "web-oauth2-loginUri";

  public static final String CONFIG_WEB_OAUTH2_CLIENTID       = "web-oauth2-clientId";

  public static final String CONFIG_WEB_APIKEY                = "web-apiKey";

  public static final String CONFIG_WEB_APIKEYCC              = "web-apiKeyCC";

  public static final String SFB_SCHEMA                       = "ms-sfb";

  // TODO until we added IM pluggable in user profile (Social) we use 'skype' here
  // TODO use SFB_SCHEMA
  public static final String SFB_TYPE                         = "skype";

  public static final String SFB_AUTODISCOVER_ORIGINS_DEFAULT =
                                                              "https://webdir.online.lync.com/autodiscover/autodiscoverservice.svc/root";

  public class WebSettingsBuilder extends SettingsBuilder {

    @Override
    public SkypeSettings build() {
      return new SkypeSettings(getType(),
                               getTitle(),
                               "Call", // TODO in18n
                               getClientId(),
                               redirectURI,
                               getVersion(),
                               getApiKey(),
                               getApiKeyCC(),
                               origins);
    }

  }

  /**
   * The Class SkypeBusinessIMInfo.
   */
  public class SkypeBusinessIMInfo extends SkypeIMInfo {

    /**
     * Instantiates a new skype business IM info.
     *
     * @param id the id
     */
    protected SkypeBusinessIMInfo(String id) {
      super(SFB_TYPE, id);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String getSchema() {
      return SFB_SCHEMA;
    }

    /**
     * Checks if is business.
     *
     * @return true, if is business
     */
    public boolean isBusiness() {
      return true;
    }
  }

  protected final String   loginUrl;

  protected final String   clientId;

  protected final String   apiKey;

  protected final String   apiKeyCC;

  protected final String[] origins;

  /**
   * Instantiates a new Skype for Business provider.
   *
   * @param skypeService the skype service
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public SkypeBusinessProvider(/*SkypeService skypeService,*/ InitParams params) throws ConfigurationException {
    super(/*skypeService, */params);

    String loginUrl = this.config.get(CONFIG_WEB_OAUTH2_URL);
    if (loginUrl == null || (loginUrl = loginUrl.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_OAUTH2_URL + " required and should be non empty.");
    }
    this.loginUrl = loginUrl;

    String clientId = this.config.get(CONFIG_WEB_OAUTH2_CLIENTID);
    if (clientId == null || (clientId = clientId.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_OAUTH2_CLIENTID + " required and should be non empty.");
    }
    this.clientId = clientId;

    String apiKey = this.config.get(CONFIG_WEB_APIKEY);
    if (apiKey == null || (apiKey = apiKey.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_APIKEY + " required and should be non empty.");
    }
    this.apiKey = apiKey;

    String apiKeyCC = this.config.get(CONFIG_WEB_APIKEYCC);
    if (apiKeyCC == null || (apiKeyCC = apiKeyCC.trim()).length() == 0) {
      throw new ConfigurationException(CONFIG_WEB_APIKEYCC + " required and should be non empty.");
    }
    this.apiKeyCC = apiKeyCC;

    ValuesParam originsParams = params.getValuesParam(CONFIG_AUTODISCOVER_ORIGINS);
    if (originsParams != null) {
      List<String> values = originsParams.getValues();
      origins = new String[values.size()];
      for (int i = 0; i < values.size(); i++) {
        origins[i] = values.get(i);
      }
    } else {
      origins = new String[0];
    }
  }

  public WebSettingsBuilder getSettings() {
    return new WebSettingsBuilder();
  }

  public String getLoginUrl() {
    return loginUrl;
  }

  public String getClientId() {
    return clientId;
  }

  public String getApiKey() {
    return apiKey;
  }

  public String getApiKeyCC() {
    return apiKeyCC;
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public IMInfo getIMInfo(String imId) throws VideoCallsProviderException {
    if (emailTest.matcher(imId).find()) {
      // it looks as email, assume it's SfB account
      return new SkypeBusinessIMInfo(imId);
    } else {
      return new SkypeIMInfo(imId);
    }
  }
  
  /**
   * {@inheritDoc}
   */
  @Override
  public boolean isSupportedType(String type) {
    // TODO regular Skype support temporal, remove it when introduce SFB support in eXo user profile
    return super.isSupportedType(type) || SkypeProvider.SKYPE_TYPE.equals(type);
  }

}
