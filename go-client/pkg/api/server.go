package api

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"companytec-client/pkg/companytec"
)

type Server struct {
	client *companytec.Client
	router *gin.Engine
}

func NewServer(client *companytec.Client) *Server {
	s := &Server{
		client: client,
		router: gin.Default(),
	}
	s.setupRoutes()
	return s
}

func (s *Server) Run(port int) error {
	return s.router.Run(fmt.Sprintf(":%d", port))
}

func (s *Server) setupRoutes() {
	s.router.GET("/status", s.handleStatus)
	s.router.GET("/calendar", s.handleCalendar)
	s.router.GET("/supply", s.handleSupply)
	s.router.GET("/visualization", s.handleVisualization)
	s.router.GET("/total/:nozzle/:mode", s.handleTotal)
	s.router.GET("/price/:nozzle", s.handlePrice)
	
	s.router.POST("/preset", s.handlePreset)
	s.router.POST("/mode", s.handleMode)
	s.router.POST("/price", s.handleChangePrice)
}

// -- Helpers --

func (s *Server) ensureConnected(c *gin.Context) bool {
	if !s.client.IsConnected() {
		if err := s.client.Connect(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Failed to connect to device", "details": err.Error()})
			return false
		}
	}
	return true
}

// -- Handlers --

func (s *Server) handleStatus(c *gin.Context) {
	if !s.ensureConnected(c) { return }

	resp, err := s.client.GetStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Parse status
	// format: (&SLBCAF...)
	// remove (& and )
	if len(resp) < 3 {
		c.JSON(http.StatusOK, gin.H{"raw": resp})
		return
	}
	data := resp[1 : len(resp)-1] // Remove ( and )
	// status codes start after 'S'? JS: substring(1, Math.min(33, data.length - 10))
	// JS: const data = response.substring(1, response.length - 1);
	// JS: const statusCodes = data.substring(1, Math.min(33, data.length - 10));
	// Actually typical response is (&Snnnnnn...)
	// Let's safe guard.
	if len(data) < 2 {
		c.JSON(http.StatusOK, gin.H{"raw": resp})
		return
	}
	
	statusCodes := data[1:] // Skip 'S'
	// Cap at 32 nozzles
	if len(statusCodes) > 32 {
		statusCodes = statusCodes[:32]
	}

	var nozzles []gin.H
	for i, r := range statusCodes {
		code := string(r)
		if code != "F" {
			nozzles = append(nozzles, gin.H{
				"position":   i + 1,
				"nozzle":     fmt.Sprintf("%02X", i+1),
				"statusCode": code,
				"status":     getStatusDescription(code),
			})
		}
	}
	
	c.JSON(http.StatusOK, gin.H{"nozzles": nozzles})
}

func getStatusDescription(code string) string {
	switch code {
	case "L": return "Available"
	case "B": return "Blocked"
	case "C": return "Finished"
	case "A": return "Refueling"
	case "E": return "Waiting"
	case "F": return "Not Present"
	case "P": return "Ready"
	default: return "Unknown"
	}
}

func (s *Server) handleCalendar(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	resp, err := s.client.ReadCalendar()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"calendar": resp})
}

func (s *Server) handleSupply(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	resp, err := s.client.ReadSupply52()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if resp == "(0)" {
		c.JSON(http.StatusOK, nil)
		return
	}
	// Parse supply
	// JS: data = response.substring(1, response.length - 3)
	if len(resp) < 4 {
		c.JSON(http.StatusOK, gin.H{"raw": resp})
		return
	}
	data := resp[1 : len(resp)-3] // skip ( and checksum+end )

	parsed := gin.H{}
	if len(data) >= 24 {
		parsed["totalToPay"] = data[0:6]
		parsed["volume"] = data[6:12]
		parsed["price"] = data[12:16]
		parsed["commaCode"] = data[16:18]
		parsed["supplyTime"] = data[18:22]
		parsed["nozzle"] = data[22:24]
	}
	if len(data) >= 30 {
		parsed["day"] = data[24:26]
		parsed["hour"] = data[26:28]
		parsed["minute"] = data[28:30]
	}
	
	c.JSON(http.StatusOK, parsed)
}

func (s *Server) handleVisualization(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	resp, err := s.client.GetVisualization()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if resp == "(0)" {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	
	// JS: data = response.substring(1, response.length - 1)
	if len(resp) < 2 {
		c.JSON(http.StatusOK, gin.H{"raw": resp})
		return
	}
	data := resp[1 : len(resp)-1]
	
	var nozzles []gin.H
	for i := 0; i+8 <= len(data); i += 8 {
		nozzles = append(nozzles, gin.H{
			"nozzle": data[i : i+2],
			"value":  data[i+2 : i+8],
		})
	}
	c.JSON(http.StatusOK, nozzles)
}

func (s *Server) handleTotal(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	nozzle := c.Param("nozzle")
	mode := c.Param("mode")
	
	resp, err := s.client.ReadTotal(nozzle, mode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// JS: data = response.substring(1, response.length - 3)
	// format: (&TnnvvvvvvCC)
	if len(resp) < 4 {
		c.JSON(http.StatusOK, gin.H{"raw": resp})
		return
	}
	data := resp[1 : len(resp)-3]
	
	// Remove header char from data? JS: mode = data[0]
	// Actually &T + nozzle + mode was sent.
	// Response to &T08L is usually (&T08LvvvvvvCC) or similar? 
	// JS ParseTotal:
	//   data = response.substring(1, response.length - 3)
	//   mode: data[0]
	//   nozzle: data.substring(1, 3)
	//   value: data.substring(3)
	
	result := gin.H{"raw": resp}
	if len(data) >= 3 {
		result["mode"] = string(data[0])
		result["nozzle"] = data[1:3]
		result["value"] = data[3:]
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) handlePrice(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	nozzle := c.Param("nozzle")
	
	resp, err := s.client.ReadPrice(nozzle, "U")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"price": resp})
}

// -- POST Handlers --

type PresetRequest struct {
	Nozzle string `json:"nozzle" binding:"required"`
	Value  string `json:"value" binding:"required"`
}

func (s *Server) handlePreset(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	var req PresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	resp, err := s.client.SetPreset(req.Nozzle, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"result": resp})
}

type ModeRequest struct {
	Nozzle string `json:"nozzle" binding:"required"`
	Mode   string `json:"mode" binding:"required"`
}

func (s *Server) handleMode(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	var req ModeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	resp, err := s.client.SetOperatingMode(req.Nozzle, req.Mode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"result": resp})
}

type PriceRequest struct {
	Nozzle string `json:"nozzle" binding:"required"`
	Level  string `json:"level" binding:"required"`
	Price  string `json:"price" binding:"required"`
}

func (s *Server) handleChangePrice(c *gin.Context) {
	if !s.ensureConnected(c) { return }
	var req PriceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	resp, err := s.client.ChangePrice(req.Nozzle, req.Level, req.Price)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"result": resp})
}
