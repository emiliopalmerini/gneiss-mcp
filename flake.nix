{
  description = "gneiss-mcp - A gneiss MCP server for Obsidian vaults";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages = {
          gneiss-mcp = pkgs.callPackage ./nix/package.nix {};
          default = self.packages.${system}.gneiss-mcp;
        };

        devShells.default = pkgs.callPackage ./nix/devShell.nix {};
      }
    );
}
