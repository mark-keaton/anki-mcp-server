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

### Statistics & Analytics
- **get_collection_stats**
  - Get comprehensive statistics about your entire Anki collection
  - Inputs:
    - `includeHTML` (boolean, optional): Include raw HTML stats report from Anki

- **get_cards_reviewed_today**
  - Get the number of cards reviewed today
  - Inputs: None

- **get_review_history**
  - Get historical review data over a specified period
  - Inputs:
    - `days` (number, optional): Number of days to look back (default: 30, max: 365)

- **get_card_reviews**
  - Get detailed review history for specific cards
  - Inputs:
    - `cardIds` (array): Array of card IDs to get review history for

- **get_deck_performance**
  - Get performance analytics for specific decks including success rates and timing
  - Inputs:
    - `deckNames` (array, optional): Array of deck names to analyze
    - `deckName` (string, optional): Single deck name (alternative to deckNames array)
    - `days` (number, optional): Number of days to analyze (default: 30)

- **get_learning_stats**
  - Get learning progress analytics including graduation rates and retention
  - Inputs:
    - `deckName` (string, optional): Specific deck to analyze (optional, analyzes all decks if not provided)
    - `days` (number, optional): Number of days to analyze (default: 30)

### Note Management
- **find_notes**
  - Search for notes using advanced filters and queries (e.g., 'deck:Japanese tag:grammar', 'front:*kanji*')
  - Inputs:
    - `query` (string): Search query using Anki search syntax
    - `limit` (number, optional): Maximum number of results to return (default: 100, max: 1000)

- **get_note_info_detailed**
  - Get comprehensive information about specific notes including all fields, tags, and associated cards
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to get information for
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)

- **update_note_fields**
  - Update fields in existing notes. Preserves HTML formatting and card scheduling.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to update
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `fields` (object): Object with field names as keys and new values as values

- **delete_notes**
  - Delete notes and all associated cards. Requires explicit confirmation for safety.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to delete
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `confirmDelete` (boolean): Must be set to true to confirm deletion (safety check)

- **add_tags_to_notes**
  - Add tags to existing notes. Creates new tags automatically if they don't exist.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to add tags to
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `tags` (array): Array of tags to add

- **remove_tags_from_notes**
  - Remove specific tags from notes. Does not delete the tags entirely, just removes them from specified notes.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to remove tags from
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `tags` (array): Array of tags to remove

- **get_all_tags**
  - Get all tags in the collection with optional usage statistics
  - Inputs:
    - `includeUsage` (boolean, optional): Include count of how many notes use each tag

- **duplicate_note**
  - Create a copy of an existing note, optionally modifying fields and changing deck
  - Inputs:
    - `noteId` (number): ID of the note to duplicate
    - `targetDeck` (string, optional): Deck to create the duplicate in
    - `fieldUpdates` (object, optional): Fields to modify in the duplicate
    - `additionalTags` (array, optional): Additional tags to add to the duplicate

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
