{ pkgs }:

let
  src = pkgs.lib.cleanSource ../.;

  bunDeps = pkgs.stdenv.mkDerivation {
    pname = "gneiss-mcp-deps";
    version = "0.1.0";
    inherit src;

    nativeBuildInputs = [ pkgs.bun ];

    buildPhase = ''
      export HOME=$TMPDIR
      bun install --frozen-lockfile
    '';

    installPhase = ''
      mkdir -p $out
      cp -r node_modules $out/
    '';

    # Fixed-output derivation — allows network access
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-llP07ZowQRlfjnUiJ7NLotwguTJHe2uarq5cMOWbElA=";
  };
in

pkgs.stdenv.mkDerivation {
  pname = "gneiss-mcp";
  version = "0.1.0";
  inherit src;

  nativeBuildInputs = [ pkgs.bun pkgs.makeWrapper ];

  buildPhase = ''
    cp -r ${bunDeps}/node_modules node_modules
  '';

  installPhase = ''
    mkdir -p $out/lib/gneiss-mcp $out/bin
    cp -r src package.json bun.lock node_modules $out/lib/gneiss-mcp/

    makeWrapper ${pkgs.bun}/bin/bun $out/bin/gneiss-mcp \
      --add-flags "run $out/lib/gneiss-mcp/src/index.ts"
  '';

  meta = with pkgs.lib; {
    description = "A gneiss MCP server for Obsidian vaults";
    homepage = "https://github.com/emiliopalmerini/gneiss-mcp";
    license = licenses.mit;
  };
}
