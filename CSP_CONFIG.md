# Content Security Policy (CSP) Configuration Guide

## Overview
This document provides comprehensive information about the Content Security Policy configuration implemented in our application. The CSP is designed to enhance security while maintaining compatibility with Web3 wallets and modern web technologies.

## CSP Directives Explained

### default-src 'self'
- Restricts all resources to the same origin by default
- Provides baseline security against external resource loading

### script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'
- **'self'**: Allows scripts from the same origin
- **'unsafe-inline'**: Required for React/Vite development and inline scripts
- **'unsafe-eval'**: Necessary for some Web3 libraries and dynamic code evaluation
- **'wasm-unsafe-eval'**: Required for WebAssembly execution (essential for ethers.js and other crypto libraries)

### style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com
- Allows stylesheets from the same origin
- Permits inline styles (needed for React component styling)
- Whitelists Google Fonts and related services

### img-src 'self' data: blob: https:
- Allows images from the same origin
- Permits data URIs (for base64 encoded images)
- Allows blob URLs (for dynamically generated images)
- Whitelists all HTTPS image sources

### font-src 'self' https://fonts.gstatic.com https://*.gstatic.com
- Allows fonts from the same origin
- Whitelists Google Fonts CDN

### connect-src 'self' https: wss:
- Allows AJAX/fetch requests to the same origin
- Permits connections to any HTTPS endpoint
- Enables WebSocket connections over secure protocol
- Includes specific blockchain RPC endpoints

### frame-src 'self' https://www.youtube.com https://*.walletconnect.com ...
- Allows embedding frames from the same origin
- Permits YouTube embeds
- Whitelists all supported wallet connection domains

### object-src 'none'
- Prohibits loading of plugins like Flash, Java, etc.
- Enhances security against plugin-based attacks

### Additional Security Headers

#### X-Content-Type-Options: nosniff
- Prevents browsers from MIME-type sniffing
- Protects against drive-by download attacks

#### X-Frame-Options: SAMEORIGIN
- Prevents clickjacking attacks
- Only allows framing by pages on the same origin

#### X-XSS-Protection: 1; mode=block
- Enables browser's built-in XSS protection
- Blocks pages from loading when XSS attack is detected

#### Referrer-Policy: strict-origin-when-cross-origin
- Controls referrer information sent with requests
- Balances privacy and functionality

## Supported Wallet Providers

The CSP configuration supports the following Web3 wallet providers:

- **MetaMask**: https://*.metamask.io
- **WalletConnect**: https://*.walletconnect.com, https://*.walletconnect.org
- **Coinbase Wallet**: https://*.coinbase.com
- **Phantom**: https://*.phantom.app
- **Rabby**: https://*.rabby.io
- **BitKeep**: https://*.bitkeep.com
- **Trust Wallet**: https://*.trustwallet.com
- **Binance Chain**: https://*.binance.org, https://*.okex.org
- **OKX Wallet**: https://*.okx.com
- **TokenPocket**: https://*.tokenpocket.pro
- **Brave Wallet**: https://*.brave.com
- **Infura**: https://*.infura.io
- **Alchemy**: https://*.alchemyapi.io, https://*.alchemy.com
- **Chainlink**: https://*.chain.link
- **Polygon Network**: https://*.polygon-rpc.com, https://*.matic.network

## Blockchain RPC Endpoints

The configuration includes support for major blockchain networks:

- **Polygon**: polygon-rpc.com, api.polygonscan.com, rpc-mumbai.maticvigil.com
- **Ethereum**: api.etherscan.io
- **Binance Smart Chain**: *.binance.org, *.okex.org
- **All HTTPS and WSS connections** for flexibility with new networks

## Implementation Notes

1. **Development vs Production**: The 'unsafe-inline' and 'unsafe-eval' directives are necessary for Vite development server and React Fast Refresh. Consider stricter policies in production if possible.

2. **WebAssembly Support**: The 'wasm-unsafe-eval' directive is critical for Web3 libraries like ethers.js that rely on cryptographic operations.

3. **Wallet Integration**: The extensive list of wallet domains ensures compatibility with most popular Web3 wallets.

4. **Dynamic Updates**: When adding new integrations, update the CSP accordingly to avoid blocking legitimate resources.

## Troubleshooting Common Issues

### Blocked Script Errors
- Check browser console for CSP violation reports
- Verify the blocked resource is properly whitelisted
- Consider using nonces or hashes for inline scripts when possible

### Wallet Connection Failures
- Confirm wallet domain is included in connect-src and frame-src
- Check for mixed content issues (HTTP vs HTTPS)
- Verify WebSocket connections are allowed

### Image Loading Problems
- Ensure image sources are either 'self', data:, blob:, or HTTPS
- Check if CORS policies are interfering with image loading

### Reporting Violations
- Monitor CSP reports at the configured reporting endpoint
- Use reports to refine the policy and remove unnecessary allowances
- Consider implementing a reporting service for production environments

## Security Considerations

While this CSP configuration enables Web3 functionality, consider these security best practices:

1. **Regular Review**: Periodically review and tighten CSP directives as the application evolves
2. **Nonce Usage**: Implement nonces for inline scripts where possible instead of 'unsafe-inline'
3. **Subresource Integrity**: Use SRI for external scripts when possible
4. **Monitoring**: Continuously monitor CSP violations and adjust policy accordingly
5. **Principle of Least Privilege**: Remove any unnecessary domain allowances

## Testing the CSP

To test CSP effectiveness:

1. Use browser developer tools to check for CSP violations
2. Test all wallet connection methods
3. Verify all external resources load correctly
4. Run automated tests to ensure functionality isn't broken
5. Use online CSP validation tools to check syntax

This configuration balances security requirements with the functional needs of a Web3-enabled application.