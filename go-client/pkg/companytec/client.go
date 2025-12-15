package companytec

import (
	"bufio"
	"fmt"
	"net"
	"sync"
	"time"
)

// Client handles communication with the Companytec device
type Client struct {
	host      string
	port      int
	conn      net.Conn
	connected bool
	mu        sync.Mutex // Protects concurrent access to the connection
	timeout   time.Duration
}

// NewClient creates a new CompanytecClient
func NewClient(host string, port int) *Client {
	return &Client{
		host:    host,
		port:    port,
		timeout: 5 * time.Second,
	}
}

// Connect establishes connection to the device
func (c *Client) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected && c.conn != nil {
		return nil
	}

	address := fmt.Sprintf("%s:%d", c.host, c.port)
	conn, err := net.DialTimeout("tcp", address, c.timeout)
	if err != nil {
		return err
	}

	c.conn = conn
	c.connected = true
	return nil
}

// Disconnect closes the connection
func (c *Client) Disconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
	c.connected = false
}

// IsConnected returns connection status
func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}

// calculateChecksum calculates sum of ASCII values and returns hex string of LSB
func (c *Client) calculateChecksum(command string) string {
	sum := 0
	// Sum ASCII values of all characters except the delimiters (handled by passing inner string)
	// JS: for (let i = 1; i < command.length; i++) -> JS implementation skips the first char?
	// JS Logic:
	// buildCommand(header, params):
	//   body = `(${header}${params}`
	//   checksum = calc(body)
	//     calc loop: starts at 1. So it skips '('.
	//   return `${body}${checksum})`
	
	// Replicating JS logic exactly:
	// If input is "(&A", loop starts at index 1 -> '&', 'A'
	// '&' (38) + 'A' (65) = 103
	
	runes := []rune(command)
	for i := 1; i < len(runes); i++ {
		sum += int(runes[i])
	}

	// Keep only least significant byte and convert to hex, uppercase, pad 2
	checksum := fmt.Sprintf("%02X", sum&0xff)
	return checksum
}

// BuildCommand formats the command string with checksum
func (c *Client) BuildCommand(header, parameters string) string {
	commandBody := fmt.Sprintf("(%s%s", header, parameters)
	checksum := c.calculateChecksum(commandBody)
	return fmt.Sprintf("%s%s)", commandBody, checksum)
}

// SendCommand sends a command and waits for response
func (c *Client) SendCommand(command string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return "", fmt.Errorf("not connected to device")
	}

	// Set deadline for write and read
	c.conn.SetDeadline(time.Now().Add(c.timeout))

	// Write
	_, err := c.conn.Write([]byte(command))
	if err != nil {
		c.Disconnect()
		return "", fmt.Errorf("write error: %v", err)
	}

	// Read
	// The protocol seems to end with ')'. We can read until then.
	// However, the JS code just waits for 'data'.
	// Safer to use a bufio Reader.
	reader := bufio.NewReader(c.conn)
	
	// Because responses might contain binary data or specific formats, 
	// but generally they look like `(&...)`.
	// We'll read until we hit a reasonable end or just read a chunk if we can't determine boundary easily.
	// Given typical simplistic TCP protocols, reading until ')' is common. 
	// Use ReadString(')') but be careful if ')' is inside data (unlikely for this legacy protocol style).
	// Let's assume ReadString(')') is correct based on BuildCommand ending in ')'.
	
	response, err := reader.ReadString(')')
	if err != nil {
		// Try to recover any partial data if needed, but usually error means connection issue or timeout
		if response == "" {
			c.Disconnect()
			return "", fmt.Errorf("read error: %v", err)
		}
		// If we got some data but hit EOF/error
	}

	// Clear deadline
	c.conn.SetDeadline(time.Time{})
	
	return response, nil
}

// -- Supply Commands --

func (c *Client) ReadSupply52() (string, error) {
	cmd := c.BuildCommand("&A", "")
	return c.SendCommand(cmd)
}

func (c *Client) ReadSupplyIdentified() (string, error) {
	cmd := c.BuildCommand("&A", "") // Same command, response length differs? Based on JS it calls same.
	return c.SendCommand(cmd)
}

func (c *Client) ReadSupplyPAF1() (string, error) {
	cmd := c.BuildCommand("&A2", "")
	return c.SendCommand(cmd)
}

func (c *Client) ReadSupplyPAF2() (string, error) {
	cmd := c.BuildCommand("&A3", "")
	return c.SendCommand(cmd)
}

func (c *Client) ReadMemoryPointers() (string, error) {
	cmd := c.BuildCommand("&T99", "P")
	return c.SendCommand(cmd)
}

func (c *Client) Increment() (string, error) {
	// JS: const command = "(&I)"; -> Direct string, likely manually checksummed or doesn't need it?
	// JS code: start with '('. 
	// "(&I)" checksum? 
	// calcChecksum("(&I") -> '&'(38) + 'I'(73) = 111 (0x6F). 
	// If it was manual, it would be "(&I6F)".
	// JS code just sends "(&I)". Maybe some commands don't use the standard buildCommand?
	// Let's follow JS strictly.
	return c.SendCommand("(&I)")
}

// -- Visualization Commands --

func (c *Client) GetVisualization() (string, error) {
	return c.SendCommand("(&V)")
}

func (c *Client) GetVisualizationIdentified() (string, error) {
	cmd := c.BuildCommand("?V", "")
	return c.SendCommand(cmd)
}

// -- Identifier Commands --

func (c *Client) ReadIdentifier() (string, error) {
	cmd := c.BuildCommand("?A", "")
	return c.SendCommand(cmd)
}

func (c *Client) ReadIdentifierFromMemory(position int) (string, error) {
	posStr := fmt.Sprintf("%06d", position)
	cmd := c.BuildCommand("?LF", posStr)
	return c.SendCommand(cmd)
}

// -- Status Commands --

func (c *Client) GetStatus() (string, error) {
	return c.SendCommand("(&S)")
}

// -- Pump Management --

// ReadTotal reads total. Mode: L=Volume, $=Value
func (c *Client) ReadTotal(nozzle, mode string) (string, error) {
	cmd := c.BuildCommand("&T", nozzle+mode)
	return c.SendCommand(cmd)
}

func (c *Client) ChangePrice(nozzle, level, price string) (string, error) {
	// Pad price to 4 chars
	// JS: price.toString().padStart(4, "0")
	// JS: `${nozzle}${level}0${priceStr}`
	// We will assume caller passes valid strings or we fix them.
	// Let's implement padding here for safety.
	if len(price) < 4 {
		price = fmt.Sprintf("%04s", price)
	}
	params := fmt.Sprintf("%s%s0%s", nozzle, level, price)
	cmd := c.BuildCommand("&U", params)
	return c.SendCommand(cmd)
}

func (c *Client) ReadPrice(nozzle, mode string) (string, error) {
	if mode == "" {
		mode = "U"
	}
	cmd := c.BuildCommand("&T", nozzle+mode)
	return c.SendCommand(cmd)
}

func (c *Client) SetPreset(nozzle, value string) (string, error) {
	// Pad value to 6 chars
	if len(value) < 6 {
		value = fmt.Sprintf("%06s", value)
	}
	cmd := c.BuildCommand("&P", nozzle+value)
	return c.SendCommand(cmd)
}

func (c *Client) SetOperatingMode(nozzle, mode string) (string, error) {
	cmd := c.BuildCommand("&M", nozzle+mode)
	return c.SendCommand(cmd)
}

// -- Clock Commands --

func (c *Client) ReadCalendar() (string, error) {
	return c.SendCommand("(&R)")
}

func (c *Client) ReadClockExtended() (string, error) {
	cmd := c.BuildCommand("&KR1", "")
	return c.SendCommand(cmd)
}
