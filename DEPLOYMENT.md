# Deployment runbook

## Current state

Last checked: July 10, 2026 at 6:32 p.m. PT.

- `socaltech.live` was registered through Porkbun for $2.57. The current renewal price is $26.26 and the registry expiration date is July 11, 2027 UTC.
- `vivekhaldar/socal-tech-signal` is public.
- GitHub Pages is configured from `main` at the repository root.
- The Pages build for commit `8ecb51332b067ac629cf39e48537b84e589d2eae` completed successfully.
- GitHub Pages has `socaltech.live` set as its custom domain.
- Porkbun's authoritative zone contains all required records:
  - Apex A: `185.199.108.153`
  - Apex A: `185.199.109.153`
  - Apex A: `185.199.110.153`
  - Apex A: `185.199.111.153`
  - `www` CNAME: `vivekhaldar.github.io.`
- At the last check, the `.live` registry DNS cluster had not yet published the domain's nameserver delegation. Registry RDAP already showed the correct Porkbun nameservers, so this was a propagation delay rather than missing configuration.
- HTTPS enforcement is not enabled yet because GitHub reported: `The certificate does not exist yet`.

Do not recreate the DNS records while propagation is pending.

## Check propagation

Check whether the `.live` registry has published the Porkbun delegation:

```sh
dig +short @v0n0.nic.live NS socaltech.live
```

Expected result:

```text
curitiba.ns.porkbun.com.
fortaleza.ns.porkbun.com.
maceio.ns.porkbun.com.
salvador.ns.porkbun.com.
```

Then check public resolvers:

```sh
dig +short @1.1.1.1 A socaltech.live
dig +short @8.8.8.8 A socaltech.live
dig +short @1.1.1.1 CNAME www.socaltech.live
```

The apex should return the four `185.199.*.153` GitHub Pages addresses and `www` should return `vivekhaldar.github.io.`

To bypass public caches and confirm the Porkbun zone directly:

```sh
dig +short @curitiba.ns.porkbun.com A socaltech.live
dig +short @curitiba.ns.porkbun.com CNAME www.socaltech.live
```

## Check GitHub Pages

```sh
gh api repos/vivekhaldar/socal-tech-signal/pages \
  --jq '{status,html_url,cname,https_enforced,source}'

gh api repos/vivekhaldar/socal-tech-signal/pages/builds/latest \
  --jq '{status,error,commit,duration,updated_at}'
```

Expected state before certificate issuance: Pages status `built`, custom domain `socaltech.live`, source `main` and `/`, and `https_enforced: false`.

## Enable HTTPS

After public DNS resolves, try:

```sh
gh api repos/vivekhaldar/socal-tech-signal/pages \
  -X PUT \
  --input - \
  --jq '{status,cname,html_url,https_enforced}' \
  <<< '{"https_enforced":true}'
```

If GitHub responds `The certificate does not exist yet`, wait and retry later. Do not change the DNS records. Certificate provisioning can lag DNS propagation.

## Final verification

```sh
curl -I http://socaltech.live/
curl -I https://socaltech.live/
curl -I https://www.socaltech.live/
```

Then open `https://socaltech.live/` in a browser and verify:

- The page loads over HTTPS without a certificate warning.
- HTTP redirects to HTTPS.
- `www` reaches the same site.
- All 37 events render.
- Regional filters work on a phone-sized viewport.
- The page has no horizontal overflow or browser errors.

The deployment is complete only when GitHub reports `https_enforced: true` and the HTTPS browser check passes.

If Porkbun API calls fail in a future session, confirm that API access is enabled in Porkbun: Domain Management → `socaltech.live` → Details → API Access.
