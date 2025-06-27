# Anki MCP Server

An MCP server implementation that connects to a locally running Anki, providing card review and creation.

This server is designed to work with the [Anki desktop app](https://apps.ankiweb.net/) and the [Anki-Connect](https://foosoft.net/projects/anki-connect/) add-on.

Make sure you have the add-on installed before using.

## Resources
- **anki://search/deckcurrent**
  - Returns all cards from current deck
  - Equivalent of `deck:current` in Anki
- **anki://search/isdue**
  - Returns cards in review and learning waiting to be studied
  - Equivalent of `is:due` in Anki
- **anki://search/isnew**
  - Returns all unseen cards 
  - Equivalent of `is:new` in Anki

## Tools

### Card Management
- **update_cards**
  - Marks cards with given card IDs as answered and gives them an ease score between 1 (Again) and 4 (Easy)
  - Inputs:
    - `answers` (array): Array of objects with `cardId` (number) and `ease` (number) fields

- **add_card**
  - Creates a new card in the Default Anki deck
  - Inputs:
    - `front` (string): Front of card
    - `back` (string): Back of card

- **get_due_cards**
  - Returns n number of cards currently due for review
  - Inputs:
    - `num` (number): Number of cards

- **get_new_cards**
  - Returns n number of cards from new
  - Inputs:
    - `num` (number): Number of cards

### Deck Management
- **list_decks**
  - Get all deck names, optionally with IDs and basic statistics
  - Inputs:
    - `includeIds` (boolean, optional): Include deck IDs in the response
    - `includeStats` (boolean, optional): Include basic statistics (new, learning, review counts)

- **get_deck_info**
  - Get detailed information about a specific deck including statistics
  - Inputs:
    - `deckName` (string): Name of the deck to get information for
    - `includeStats` (boolean, optional): Include detailed statistics for the deck

- **get_deck_stats**
  - Get comprehensive statistics for one or more decks
  - Inputs:
    - `deckNames` (array, optional): Array of deck names to get statistics for
    - `deckName` (string, optional): Single deck name (alternative to deckNames array)

- **create_deck**
  - Create a new deck. Supports nested decks using '::' separator (e.g., 'Japanese::JLPT N5')
  - Inputs:
    - `deckName` (string): Name of the deck to create. Use '::' for nested decks (e.g., 'Parent::Child')

- **delete_deck**
  - Delete a deck and all its cards. Requires explicit confirmation for safety.
  - Inputs:
    - `deckName` (string): Name of the deck to delete
    - `confirmDelete` (boolean): Must be set to true to confirm deletion (safety check)

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Configuration 

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anki-mcp-server": {
      "command": "/path/to/anki-mcp-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
