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

import org.exoplatform.container.configuration.ConfigurationException;
import org.exoplatform.container.xml.InitParams;
import org.exoplatform.videocalls.UserInfo.IMInfo;
import org.exoplatform.videocalls.VideoCallsProvider;
import org.exoplatform.videocalls.VideoCallsProviderException;

/**
 * Created by The eXo Platform SAS
 * 
 * @author <a href="mailto:pnedonosko@exoplatform.com">Peter Nedonosko</a>
 * @version $Id: SkypeProvider.java 00000 Mar 30, 2017 pnedonosko $
 * 
 */
public class SkypeProvider extends VideoCallsProvider {

  public static final String SKYPE_SCHEMA                = "skype";

  public static final String SKYPE_TYPE                  = SKYPE_SCHEMA;

  public static final String SKYPE_TITLE                 = "Skype";
  
  public static final String VERSION                 = "eXoWebSkype/1.0.0";

  public static final String CONFIG_AUTODISCOVER_ORIGINS = "autodiscover-origins";

  public class SettingsBuilder {

    protected String redirectURI;

    public SettingsBuilder redirectURIBase(String redirectURIBase) {
      StringBuilder uri = new StringBuilder(redirectURIBase);
      if (uri.charAt(uri.length() - 1) != '/') {
        uri.append('/');
      }
      this.redirectURI = uri.append("portal/skype").toString();
      return this;
    }

    public SkypeSettings build() {
      return new SkypeSettings(getType(),
                               getTitle(),
                               "Call", // TODO in18n
                               null,
                               redirectURI,
                               getVersion(),
                               null,
                               null,
                               new String[0]);
    }
  }

  /**
   * The Class SkypeIMInfo.
   */
  public class SkypeIMInfo extends IMInfo {

    /**
     * Instantiates a new skype IM info.
     *
     * @param id the id
     */
    protected SkypeIMInfo(String id) {
      super(SKYPE_TYPE, id);
    }

    /**
     * Instantiates a new skype IM info.
     *
     * @param type the type
     * @param id the id
     */
    protected SkypeIMInfo(String type, String id) {
      super(type, id);
    }

    public String getSchema() {
      return SKYPE_SCHEMA;
    }

    /**
     * Checks if is business.
     *
     * @return true, if is business
     */
    public boolean isBusiness() {
      return false;
    }
  }

  /**
   * Instantiates a new skype provider.
   *
   * @param skypeService the skype service
   * @param params the params
   * @throws ConfigurationException the configuration exception
   */
  public SkypeProvider(/*SkypeService skypeService,*/ InitParams params) throws ConfigurationException {
    super(params);
    //this.skypeService = skypeService;
  }

  public SettingsBuilder getSettings() {
    return new SettingsBuilder();
  }

  /**
   * {@inheritDoc}
   */
  @Override
  public IMInfo getIMInfo(String imId) throws VideoCallsProviderException {
    if (emailTest.matcher(imId).find()) {
      throw new SkypeProviderException("Email not supported as a regular Skype IM. Probably you need Business provider. Check the configuration.");
    } else {
      return new SkypeIMInfo(imId);
    }
  }

  @Override
  public String getVersion() {
    return VERSION;
  }

  @Override
  public String getType() {
    return SKYPE_SCHEMA;
  }

  @Override
  public String getTitle() {
    return SKYPE_TITLE;
  }

}
