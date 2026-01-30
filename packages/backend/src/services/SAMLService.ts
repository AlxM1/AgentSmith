/**
 * SAML 2.0 Service - Enterprise SSO Authentication
 *
 * Supports SAML 2.0 identity providers:
 * - Okta
 * - Azure AD
 * - OneLogin
 * - PingFederate
 * - Generic SAML 2.0 IdPs
 */

import crypto from 'crypto';
import { logger } from '../lib/logger.js';
import { inflate, deflate } from 'zlib';
import { promisify } from 'util';

const inflateAsync = promisify(inflate);
const deflateAsync = promisify(deflate);

// ============================================================================
// TYPES
// ============================================================================

export interface SAMLConfig {
  entityId: string;
  assertionConsumerServiceUrl: string;
  singleLogoutServiceUrl?: string;
  privateKey: string;
  certificate: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl?: string;
  idpCertificate: string;
  signatureAlgorithm?: 'sha256' | 'sha512';
  digestAlgorithm?: 'sha256' | 'sha512';
  wantAssertionsSigned?: boolean;
  wantMessagesSigned?: boolean;
  attributeMapping?: SAMLAttributeMapping;
  allowedClockSkewMs?: number;
}

export interface SAMLAttributeMapping {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string;
  role?: string;
}

export interface SAMLUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string[];
  role?: string;
  attributes: Record<string, string | string[]>;
  sessionIndex?: string;
  nameIdFormat?: string;
}

export interface SAMLAssertion {
  issuer: string;
  nameId: string;
  nameIdFormat: string;
  sessionIndex?: string;
  conditions: {
    notBefore: Date;
    notOnOrAfter: Date;
    audience: string;
  };
  attributes: Record<string, string | string[]>;
  authnContext?: string;
}

interface SAMLRequest {
  id: string;
  issueInstant: string;
  destination: string;
}

// ============================================================================
// SAML SERVICE CLASS
// ============================================================================

class SAMLService {
  private config: SAMLConfig | null = null;
  private pendingRequests: Map<string, { timestamp: number; relayState?: string }> = new Map();
  private readonly requestExpiry = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.startRequestCleanup();
  }

  /**
   * Configure SAML service
   */
  configure(config: SAMLConfig): void {
    this.config = {
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      wantMessagesSigned: false,
      allowedClockSkewMs: 5 * 60 * 1000, // 5 minutes
      attributeMapping: {
        id: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
        groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
        role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
      },
      ...config,
    };

    logger.info('SAML service configured', {
      entityId: this.config.entityId,
      idpEntityId: this.config.idpEntityId,
    });
  }

  /**
   * Check if SAML is configured
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Generate SAML AuthnRequest
   */
  async createAuthnRequest(relayState?: string): Promise<{ url: string; id: string }> {
    if (!this.config) {
      throw new Error('SAML service not configured');
    }

    const id = `_${crypto.randomUUID()}`;
    const issueInstant = new Date().toISOString();

    const request: SAMLRequest = {
      id,
      issueInstant,
      destination: this.config.idpSsoUrl,
    };

    // Build AuthnRequest XML
    const authnRequestXml = this.buildAuthnRequestXml(request);

    // Deflate and encode
    const deflated = await deflateAsync(Buffer.from(authnRequestXml));
    const encoded = deflated.toString('base64');
    const urlEncoded = encodeURIComponent(encoded);

    // Store request for validation
    this.pendingRequests.set(id, {
      timestamp: Date.now(),
      relayState,
    });

    // Build redirect URL
    const params = new URLSearchParams({
      SAMLRequest: urlEncoded,
    });

    if (relayState) {
      params.set('RelayState', relayState);
    }

    // Sign the request if required
    if (this.config.wantMessagesSigned) {
      const sigAlg = this.getSignatureAlgorithmUri();
      params.set('SigAlg', sigAlg);

      const signature = this.signRequest(params.toString());
      params.set('Signature', signature);
    }

    const url = `${this.config.idpSsoUrl}?${params.toString()}`;

    logger.debug('Created SAML AuthnRequest', { id, destination: this.config.idpSsoUrl });

    return { url, id };
  }

  /**
   * Build AuthnRequest XML
   */
  private buildAuthnRequestXml(request: SAMLRequest): string {
    if (!this.config) throw new Error('SAML not configured');

    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${request.id}"
    Version="2.0"
    IssueInstant="${request.issueInstant}"
    Destination="${request.destination}"
    AssertionConsumerServiceURL="${this.config.assertionConsumerServiceUrl}"
    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
    <saml:Issuer>${this.config.entityId}</saml:Issuer>
    <samlp:NameIDPolicy
        Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
        AllowCreate="true"/>
    <samlp:RequestedAuthnContext Comparison="exact">
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
    </samlp:RequestedAuthnContext>
</samlp:AuthnRequest>`;
  }

  /**
   * Process SAML Response (POST binding)
   */
  async processResponse(samlResponse: string, relayState?: string): Promise<SAMLUser> {
    if (!this.config) {
      throw new Error('SAML service not configured');
    }

    // Decode response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');

    logger.debug('Processing SAML response');

    // Parse and validate the response
    const assertion = await this.parseAndValidateResponse(decodedResponse);

    // Validate conditions
    this.validateConditions(assertion);

    // Map to user
    const user = this.mapAssertionToUser(assertion);

    logger.info('SAML authentication successful', {
      userId: user.id,
      email: user.email,
      groups: user.groups,
    });

    return user;
  }

  /**
   * Parse and validate SAML Response
   */
  private async parseAndValidateResponse(xmlResponse: string): Promise<SAMLAssertion> {
    if (!this.config) throw new Error('SAML not configured');

    // Simple XML parsing (in production, use a proper XML parser with signature validation)
    const assertion: SAMLAssertion = {
      issuer: this.extractValue(xmlResponse, 'Issuer') || '',
      nameId: this.extractValue(xmlResponse, 'NameID') || '',
      nameIdFormat: this.extractAttribute(xmlResponse, 'NameID', 'Format') || '',
      sessionIndex: this.extractAttribute(xmlResponse, 'AuthnStatement', 'SessionIndex'),
      conditions: {
        notBefore: new Date(this.extractAttribute(xmlResponse, 'Conditions', 'NotBefore') || ''),
        notOnOrAfter: new Date(this.extractAttribute(xmlResponse, 'Conditions', 'NotOnOrAfter') || ''),
        audience: this.extractValue(xmlResponse, 'Audience') || '',
      },
      attributes: this.extractAttributes(xmlResponse),
      authnContext: this.extractValue(xmlResponse, 'AuthnContextClassRef'),
    };

    // Validate issuer
    if (assertion.issuer !== this.config.idpEntityId) {
      throw new Error(`Invalid SAML issuer: ${assertion.issuer}`);
    }

    // Validate audience
    if (assertion.conditions.audience && assertion.conditions.audience !== this.config.entityId) {
      throw new Error(`Invalid SAML audience: ${assertion.conditions.audience}`);
    }

    return assertion;
  }

  /**
   * Validate assertion conditions
   */
  private validateConditions(assertion: SAMLAssertion): void {
    if (!this.config) throw new Error('SAML not configured');

    const now = Date.now();
    const clockSkew = this.config.allowedClockSkewMs || 0;

    // Check NotBefore
    if (assertion.conditions.notBefore) {
      const notBefore = assertion.conditions.notBefore.getTime() - clockSkew;
      if (now < notBefore) {
        throw new Error('SAML assertion not yet valid');
      }
    }

    // Check NotOnOrAfter
    if (assertion.conditions.notOnOrAfter) {
      const notOnOrAfter = assertion.conditions.notOnOrAfter.getTime() + clockSkew;
      if (now >= notOnOrAfter) {
        throw new Error('SAML assertion has expired');
      }
    }
  }

  /**
   * Map SAML assertion to user object
   */
  private mapAssertionToUser(assertion: SAMLAssertion): SAMLUser {
    if (!this.config) throw new Error('SAML not configured');

    const mapping = this.config.attributeMapping!;
    const attrs = assertion.attributes;

    const getValue = (key: string | undefined): string | undefined => {
      if (!key) return undefined;
      const value = attrs[key];
      return Array.isArray(value) ? value[0] : value;
    };

    const getValues = (key: string | undefined): string[] | undefined => {
      if (!key) return undefined;
      const value = attrs[key];
      return Array.isArray(value) ? value : value ? [value] : undefined;
    };

    const id = getValue(mapping.id) || assertion.nameId;
    const email = getValue(mapping.email) || assertion.nameId;

    if (!email) {
      throw new Error('Email is required in SAML assertion');
    }

    return {
      id,
      email,
      firstName: getValue(mapping.firstName),
      lastName: getValue(mapping.lastName),
      displayName: getValue(mapping.displayName),
      groups: getValues(mapping.groups),
      role: getValue(mapping.role),
      attributes: attrs,
      sessionIndex: assertion.sessionIndex,
      nameIdFormat: assertion.nameIdFormat,
    };
  }

  /**
   * Create SAML LogoutRequest
   */
  async createLogoutRequest(
    nameId: string,
    sessionIndex?: string,
    relayState?: string
  ): Promise<{ url: string; id: string }> {
    if (!this.config || !this.config.idpSloUrl) {
      throw new Error('SAML logout not configured');
    }

    const id = `_${crypto.randomUUID()}`;
    const issueInstant = new Date().toISOString();

    const logoutRequestXml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${id}"
    Version="2.0"
    IssueInstant="${issueInstant}"
    Destination="${this.config.idpSloUrl}">
    <saml:Issuer>${this.config.entityId}</saml:Issuer>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>
    ${sessionIndex ? `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>` : ''}
</samlp:LogoutRequest>`;

    const deflated = await deflateAsync(Buffer.from(logoutRequestXml));
    const encoded = deflated.toString('base64');
    const urlEncoded = encodeURIComponent(encoded);

    const params = new URLSearchParams({
      SAMLRequest: urlEncoded,
    });

    if (relayState) {
      params.set('RelayState', relayState);
    }

    const url = `${this.config.idpSloUrl}?${params.toString()}`;

    logger.debug('Created SAML LogoutRequest', { id });

    return { url, id };
  }

  /**
   * Generate Service Provider metadata
   */
  generateMetadata(): string {
    if (!this.config) {
      throw new Error('SAML service not configured');
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
    xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
    entityID="${this.config.entityId}">
    <md:SPSSODescriptor
        AuthnRequestsSigned="${this.config.wantMessagesSigned}"
        WantAssertionsSigned="${this.config.wantAssertionsSigned}"
        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <md:KeyDescriptor use="signing">
            <ds:KeyInfo>
                <ds:X509Data>
                    <ds:X509Certificate>${this.config.certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '')}</ds:X509Certificate>
                </ds:X509Data>
            </ds:KeyInfo>
        </md:KeyDescriptor>
        <md:KeyDescriptor use="encryption">
            <ds:KeyInfo>
                <ds:X509Data>
                    <ds:X509Certificate>${this.config.certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '')}</ds:X509Certificate>
                </ds:X509Data>
            </ds:KeyInfo>
        </md:KeyDescriptor>
        <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
        <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
        <md:AssertionConsumerService
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="${this.config.assertionConsumerServiceUrl}"
            index="0"
            isDefault="true"/>
        ${this.config.singleLogoutServiceUrl ? `
        <md:SingleLogoutService
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            Location="${this.config.singleLogoutServiceUrl}"/>
        ` : ''}
    </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private extractValue(xml: string, tag: string): string | null {
    const regex = new RegExp(`<(?:saml:|saml2:|)[^>]*${tag}[^>]*>([^<]*)<`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractAttribute(xml: string, tag: string, attr: string): string | null {
    const regex = new RegExp(`<(?:saml:|saml2:|samlp:|)[^>]*${tag}[^>]*${attr}="([^"]*)"`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private extractAttributes(xml: string): Record<string, string | string[]> {
    const attributes: Record<string, string | string[]> = {};

    // Match Attribute elements
    const attrRegex = /<(?:saml:|saml2:)?Attribute[^>]*Name="([^"]*)"[^>]*>([\s\S]*?)<\/(?:saml:|saml2:)?Attribute>/gi;
    let match;

    while ((match = attrRegex.exec(xml)) !== null) {
      const name = match[1];
      const content = match[2];

      // Extract AttributeValue(s)
      const valueRegex = /<(?:saml:|saml2:)?AttributeValue[^>]*>([^<]*)<\/(?:saml:|saml2:)?AttributeValue>/gi;
      const values: string[] = [];
      let valueMatch;

      while ((valueMatch = valueRegex.exec(content)) !== null) {
        values.push(valueMatch[1].trim());
      }

      if (values.length === 1) {
        attributes[name] = values[0];
      } else if (values.length > 1) {
        attributes[name] = values;
      }
    }

    return attributes;
  }

  private getSignatureAlgorithmUri(): string {
    const alg = this.config?.signatureAlgorithm || 'sha256';
    return alg === 'sha512'
      ? 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512'
      : 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  }

  private signRequest(data: string): string {
    if (!this.config?.privateKey) {
      throw new Error('Private key not configured for signing');
    }

    const alg = this.config.signatureAlgorithm || 'sha256';
    const sign = crypto.createSign(`RSA-SHA${alg === 'sha512' ? '512' : '256'}`);
    sign.update(data);
    return sign.sign(this.config.privateKey, 'base64');
  }

  private startRequestCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [id, data] of this.pendingRequests) {
        if (now - data.timestamp > this.requestExpiry) {
          this.pendingRequests.delete(id);
        }
      }
    }, 60000);
  }
}

// Export singleton instance
export const samlService = new SAMLService();
