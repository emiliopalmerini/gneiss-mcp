{ pkgs }:

pkgs.stdenv.mkDerivation {
  pname = "gneiss-mcp";
  version = "0.1.0";
  src = pkgs.lib.cleanSource ../.;

  nativeBuildInputs = [ pkgs.bun pkgs.makeWrapper ];

  buildPhase = ''
    export HOME=$TMPDIR
    bun install --frozen-lockfile
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
    maintainers = [ ];
  };
}
