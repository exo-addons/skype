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
 * @version $Id: UserCallListener.java 00000 Jul 18, 2017 pnedonosko $
 */
public abstract class UserCallListener {

  /** The user id. */
  protected final String userId;
  
  /**
   * Instantiates a new incoming call listener.
   *
   * @param userId the user id
   */
  public UserCallListener(String userId) {
    this.userId = userId;
  }

  /**
   * Gets the user id.
   *
   * @return the user id
   */
  public String getUserId() {
    return userId;
  }
  
  /**
   * Checks if is listening.
   *
   * @return true, if is listening
   */
  public abstract boolean isListening();
  
  /**
   * Notify.
   *
   * @param callId the call id
   * @param providerType provider type
   * @param callState the call status
   * @param callerId the caller id
   * @param callerType the caller type
   */
  public abstract void onCallState(String callId, String providerType, String callState, String callerId, String callerType);
  
  /**
   * On participant joined.
   * @param callId the call id
   * @param providerType the provider type
   * @param partId the participant user id
   */
  public abstract void onPartJoined(String callId, String providerType, String partId);
  
  /**
   * On participant leaved.
   * @param callId the call id
   * @param providerType the provider type
   * @param partId the participant user id
   */
  public abstract void onPartLeaved(String callId, String providerType, String partId);

}
